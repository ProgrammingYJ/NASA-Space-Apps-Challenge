'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Sources } = require('./sources');
const { parse, canonical, hash, safePath, atomic, atomicRaw, lock } = require('./storage');
const { validator, sessionRules, omitNullFields } = require('./schema');
const { massScenario, longTerm, timelineScene, calendarMs, finite } = require('./science');
const { SOURCE_VERIFICATION_POLICY } = require('./verification-policy');
const LIMIT = 8_000_000;
const uuid = () => crypto.randomUUID().replaceAll('-', '');
const now = () => new Date().toISOString();
class HTTPError extends Error { constructor(status, code) { super(code); this.status = status; } }
const fail = (status, code) => { throw new HTTPError(status, code); };
function pair(ids) { return Array.isArray(ids) && ids.length === 2 && ids[0] !== ids[1] && (ids.every(x => ['S01', 'S02'].includes(x)) || ids.every(x => ['S12', 'S14'].includes(x))); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
async function readBody(request) {
  if (Number(request.headers['content-length']) > LIMIT) fail(413, 'request_too_large');
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > LIMIT) fail(413, 'request_too_large'); chunks.push(chunk); }
  if (length === 0) return {};
  try { return parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { fail(422, 'invalid_request'); }
}
function queryNumber(url, key, fallback, integer = false) {
  const raw = url.searchParams.get(key); if (raw === null && fallback !== undefined) return fallback;
  if (raw === null || !raw.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) fail(422, 'unsupported_simulation_date');
  const value = Number(raw); if (!Number.isFinite(value) || integer && !Number.isInteger(value)) fail(422, 'unsupported_simulation_date'); return value;
}

async function start(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const state = path.resolve(options.stateDir || process.env.APP_STATE_DIR || path.join(root, 'var', 'node'));
  const port = options.port ?? Number(process.env.PORT || process.env.APP_PORT || 3002), host = options.host || '0.0.0.0';
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('invalid_port');
  const unlock = lock(state), sources = new Sources(root);
  const validate = validator(parse(fs.readFileSync(path.join(root, 'contracts/openapi.json'), 'utf8')));
  const jobs = new Map(); let active = null, closing = false, manifest;
  const savedJobs = path.join(state, 'jobs'); fs.mkdirSync(savedJobs, { recursive: true });
  const persist = job => { job.updated_at = now(); atomic(path.join(savedJobs, job.job_id + '.json'), job); };
  for (const name of fs.readdirSync(savedJobs)) {
    if (!/^job_[a-f0-9]{32}\.json$/.test(name)) continue;
    const job = parse(fs.readFileSync(path.join(savedJobs, name), 'utf8'));
    if (job.job_id + '.json' !== name) throw new Error('invalid_job_file');
    if (['queued', 'running'].includes(job.state)) { job.state = 'interrupted'; job.stage = 'restart'; persist(job); }
    jobs.set(job.job_id, job);
  }
  const getManifest = async () => {
    try { if (manifest) await sources.call('verify'); else manifest = await sources.call('manifest'); return manifest; }
    catch { fail(503, 'source_unavailable'); }
  };
  // Routing metadata is immutable. A following payload transaction validates
  // the current manifest and every required file before using this metadata.
  const manifestMetadata = async () => manifest || getManifest();
  const snapshot = async (key, code = 'source_unavailable', strong = false) => {
    try { return await sources.call('snapshot', key, strong); } catch { fail(503, code); }
  };
  const checkSchema = (name, value) => { try { return validate(name, value); } catch { fail(422, 'invalid_request'); } };
  async function comparisonFor(ids, strong = false, forImport = false) {
    try {
      const record = await sources.call(forImport ? 'importComparison' : 'comparison', ids.join(','), strong);
      const result = parse(record.raw);
      if (!/^cmp_[a-f0-9]{24}$/.test(result.result_id) || result.frames.map(v => v.observation_id).join(',') !== ids.join(',') || hash(record.raw) !== record.comparison_sha256) throw new Error('comparison_integrity');
      return { record, result };
    } catch { fail(503, 'source_unavailable'); }
  }
  async function getResult(id, strong = false) {
    if (!/^cmp_[a-f0-9]{24}$/.test(id)) fail(404, 'result_not_found');
    const m = await manifestMetadata().catch(() => fail(503, 'source_unavailable'));
    for (const [key, entry] of Object.entries(m.comparisons)) {
      if (entry.result_id && entry.result_id !== id) continue;
      const value = await comparisonFor(entry.observation_ids || key.split(','), strong);
      if (value.result.result_id === id) {
        const stored = path.join(state, 'comparisons', id + '.json');
        if (!fs.existsSync(stored)) fail(404, 'result_not_found');
        if (hash(fs.readFileSync(stored)) !== value.record.comparison_sha256) fail(409, 'integrity_mismatch');
        return value;
      }
    }
    fail(404, 'result_not_found');
  }
  async function pump() {
    if (active || closing) return;
    const job = [...jobs.values()].find(j => j.state === 'queued'); if (!job) return;
    active = job.job_id; Object.assign(job, { state: 'running', stage: 'validating_built_fits_cache', progress: .1 }); persist(job);
    try {
      const { record, result } = await comparisonFor(job.observation_ids);
      if (closing || job.cancel_requested) Object.assign(job, { state: closing ? 'interrupted' : 'cancelled', stage: closing ? 'shutdown' : 'cancelled' });
      else {
        atomicRaw(path.join(state, 'comparisons', result.result_id + '.json'), record.raw);
        if (hash(fs.readFileSync(path.join(state, 'comparisons', result.result_id + '.json'))) !== record.comparison_sha256) throw new Error('result_integrity');
        Object.assign(job, { state: 'succeeded', stage: 'complete', progress: 1, result_id: result.result_id,
          runtime_processing: 'source_verified_build_time_fits_result_cache_reused_no_runtime_fits_analysis', source_verification_policy: SOURCE_VERIFICATION_POLICY.version });
      }
    } catch (error) {
      if (closing || job.cancel_requested) Object.assign(job, { state: closing ? 'interrupted' : 'cancelled', stage: closing ? 'shutdown' : 'cancelled' });
      else Object.assign(job, { state: 'failed', stage: 'failed', error: { code: error.status ? error.message : 'result_rejected', message_key: 'errors.processing', details: {}, request_id: job.job_id } });
    }
    finally { persist(job); active = null; if (!closing) setImmediate(pump); }
  }
  async function contextReasons(session) {
    const c = session.universe_context; if (!c) return [];
    let m, values;
    const keys = ['timeline'];
    if (c.mass_scenario) keys.push('mass_scenarios');
    if (c.selected_black_hole_id) keys.push('black_holes');
    if (c.simulation_context) keys.push('long_term_model');
    try { m = await manifestMetadata(); values = await sources.call('snapshots', keys); } catch { return ['universe_ephemeris_unavailable']; }
    const hashes = new Map(m.source_files.map(f => [f.path, f.sha256]));
    const epoch = Date.parse(c.model_epoch), timeline = values.timeline;
    if (!timeline || !/(Z|[+-]\d\d:\d\d)$/.test(c.model_epoch) || !finite(epoch, Date.parse(timeline.start_epoch), Date.parse(timeline.end_epoch))) return ['unsupported_model_epoch'];
    if (c.timeline_algorithm_version !== 'display-hermite-v1' && !timeline.knots.some(k => Date.parse(k.epoch) === epoch)) return ['unsupported_model_epoch'];
    if (!c.timeline_algorithm_version && c.orbit_manifest_sha256 && epoch !== Date.parse(timeline.default_epoch)) return ['orbit_guide_reference_changed'];
    const fields = [ ['source_manifest_sha256', 'solar_system_ephemeris.json', 'universe_ephemeris_changed'], ['orbit_manifest_sha256', 'solar_system_orbits.json', 'orbit_ephemeris_changed'], ['galaxy_manifest_sha256', 'galaxies.json', 'galaxy_sources_changed'], ['appearance_manifest_sha256', 'appearance.json', 'appearance_sources_changed'], ['small_body_appearance_manifest_sha256', 'small_body_appearance.json', 'small_body_appearance_sources_changed'], ['planet_criteria_manifest_sha256', 'planet_criteria.json', 'planet_criteria_sources_changed'], ['mass_scenarios_manifest_sha256', 'mass_scenarios.json', 'mass_scenario_sources_changed'], ['observer_physics_manifest_sha256', 'observer_physics.json', 'observer_physics_sources_changed'], ['black_holes_manifest_sha256', 'black_holes.json', 'black_hole_sources_changed'], ['extended_solar_manifest_sha256', 'extended_solar.json', 'extended_solar_sources_changed'] ];
    for (const [field, name, reason] of fields) if (c[field] && hashes.get('data/manifests/' + name) !== c[field]) return [reason];
    if (c.mass_scenario) { try { massScenario(values.mass_scenarios, c.mass_scenario); } catch { return ['mass_scenario_data_unavailable']; } }
    if (c.selected_black_hole_id && !Object.hasOwn(values.black_holes.objects, c.selected_black_hole_id)) return ['unsupported_black_hole_selection'];
    if (c.simulation_context) {
      const model = values.long_term_model;
      if (model.source_manifest_sha256 !== c.simulation_context.source_manifest_sha256) return ['simulation_model_changed'];
      const sim = c.simulation_context.model_calendar_ms, lo = model.coverage.min_date, hi = model.coverage.max_date;
      if (sim < calendarMs(lo.year, lo.month, lo.day) || sim > calendarMs(hi.year, hi.month, hi.day)) return ['unsupported_simulation_date'];
    }
    return [];
  }
  async function route(request, response) {
    const requestId = uuid(); response.setHeader('X-Request-ID', requestId); response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (value, status = 200) => { const raw = canonical(value); response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(raw) }); response.end(raw); };
    try {
      if (!['GET', 'HEAD', 'POST'].includes(request.method)) fail(405, 'method_not_allowed');
      const rawPath = request.url.split('?')[0]; let decoded;
      try { decoded = decodeURIComponent(rawPath); } catch { fail(400, 'invalid_request'); }
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(p => p === '..' || p === '.')) fail(404, 'not_found');
      const url = new URL(request.url, 'http://localhost'), pathname = url.pathname;
      if (request.method === 'GET' && pathname === '/health/live') return send({ status: 'live' });
      if (request.method === 'GET' && pathname === '/health/ready') {
        let storage = false, verified = false; const probe = path.join(state, '.probe_' + uuid());
        try { fs.writeFileSync(probe, 'ready', { flag: 'wx' }); storage = fs.readFileSync(probe, 'utf8') === 'ready'; } catch {} finally { try { fs.unlinkSync(probe); } catch {} }
        try { await sources.call('verify'); verified = true; } catch {}
        const alive = sources.alive && Date.now() - sources.heartbeat < 60000;
        return send({ status: storage && verified && alive ? 'ready' : 'unavailable', storage_writable: storage, worker_alive: alive, source_bundle_verified: verified, runtime: 'node', science_mode: 'verified_build_cache_and_ported_display_models' }, storage && verified && alive ? 200 : 503);
      }
      if (pathname.startsWith('/api/')) {
        if (!pathname.startsWith('/api/v1/')) fail(404, 'not_found');
        const routeName = pathname.slice('/api/v1/'.length), q = key => url.searchParams.get(key);
        if (request.method === 'GET') {
          if (routeName === 'runtime') { const m = await getManifest().catch(() => fail(503, 'source_unavailable')); return send({ schema_version: '1.0', runtime: 'node', observation_processing: 'verified_build_cache', snapshot_exported_utc: m.exported_utc, supported_observation_pairs: [['S01', 'S02'], ['S12', 'S14']], arbitrary_fits_inputs: false, source_verification_policy: SOURCE_VERIFICATION_POLICY }); }
          const fixed = { objects: ['objects'], timeline: ['timeline'], appearance: ['appearance', 'appearance_unavailable'], 'small-body-appearance': ['small_body_appearance', 'small_body_appearance_unavailable'], 'mass-scenarios': ['mass_scenarios', 'mass_scenario_source_unavailable'], 'black-holes': ['black_holes', 'black_hole_source_unavailable'], 'observer-physics': ['observer_physics', 'observer_physics_source_unavailable'], 'cosmic-history': ['cosmic_history', 'history_source_unavailable'], 'cosmic-observations': ['cosmic_observations', 'history_observation_unavailable'], 'catalog/galaxies': ['galaxies'], 'kuiper-belt': ['kuiper_belt'], 'long-term-model': ['long_term_model', 'simulation_source_unavailable'], 'catalog/exoplanets': ['exoplanets', 'catalog_unavailable'] };
          if (fixed[routeName]) return send(await snapshot(...fixed[routeName]));
          if (routeName === 'universe') { const scene = await snapshot('universe'), timeline = await snapshot('timeline'); try { return send(timelineScene(scene, timeline, q('epoch') ?? timeline.default_epoch)); } catch { fail(422, 'unsupported_model_epoch'); } }
          if (routeName === 'long-term-simulation') { try { return send(longTerm(await snapshot('long_term_model', 'simulation_source_unavailable'), queryNumber(url, 'year', undefined, true), queryNumber(url, 'month', 1, true), queryNumber(url, 'day', 1, true), queryNumber(url, 'hour', 0))); } catch (error) { if (error instanceof HTTPError) throw error; fail(422, 'unsupported_simulation_date'); } }
          if (routeName === 'observations') { const id = q('object_id') || 'epsilon-indi-b'; if (['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(id)) return send({ object_id: id, observations: [], status: 'not_selected_for_comparison', next_cursor: null }); const m = await getManifest().catch(() => fail(503, 'source_unavailable')); if (!m.snapshots['observations_' + id]) fail(404, 'object_not_found'); return send(await snapshot('observations_' + id)); }
          if (routeName === 'planet-criteria') { const value = await snapshot('planet_criteria', 'planet_criteria_unavailable'), id = q('object_id'); if (id !== null) { if (!Object.hasOwn(value.objects, id)) fail(422, 'unsupported_planet_criteria_object'); value.objects = { [id]: value.objects[id] }; value.object_filter = id; } return send(value); }
          if (routeName.startsWith('catalog/exoplanets/')) { let value; try { value = await sources.call('dictionary_entry', { snapshot: 'exoplanet_details', id: routeName.slice('catalog/exoplanets/'.length) }); } catch { fail(503, 'catalog_unavailable'); } if (!value) fail(404, 'object_not_found'); return send(value); }
          if (routeName === 'catalog/exoplanet-observations') { const value = await snapshot('exoplanet_observations', 'planet_observation_unavailable'), id = q('object_id'); if (id !== null) { if (!/^exo-[a-f0-9]{20}$/.test(id)) fail(422, 'unsupported_catalog_selection'); let selected; try { selected = await sources.call('dictionary_entry', { snapshot: 'exoplanet_details', id }); } catch { fail(503, 'planet_observation_unavailable'); } if (!selected) fail(404, 'object_not_found'); value.observations = value.observations.filter(v => v.object_id === id); value.object_filter = id; } return send(value); }
          if (routeName === 'catalog/extragalactic-planets') { const value = await snapshot('extragalactic_planets', 'planet_review_unavailable'), id = q('galaxy_id'); if (id !== null) { const catalogue = await snapshot('universe_catalog'); if (!catalogue.galaxy_ids.includes(id)) fail(422, 'unsupported_catalog_selection'); value.reviewed_unconfirmed_evidence = value.reviewed_unconfirmed_evidence.filter(item => item.galaxy_id === id); value.galaxy_filter = id; } return send(value); }
          if (routeName === 'catalog/solar-system') { const id = q('parent_id'); if (id === null) return send(await snapshot('solar_system', 'catalog_unavailable')); const m = await getManifest(); if (!m.snapshots['solar_parent_' + id]) fail(422, 'unknown_extended_parent'); return send(await snapshot('solar_parent_' + id, 'catalog_unavailable')); }
          if (routeName === 'catalog/universe') return send(await hierarchy(q('galaxy_id'), q('parent_id')));
          if (routeName === 'cosmic-history/sample') { const history = await snapshot('cosmic_history'), age = queryNumber(url, 'age_gyr', 0); if (age < 0 || age > 13.8) fail(422, 'invalid_request'); const stage = [...history.stages].reverse().find(v => v.age_gyr <= age); return send({ ...stage, stage_anchor_age_gyr: stage.age_gyr, age_gyr: age, lookback_gyr: Number((13.8 - age).toFixed(12)), reference_age_gyr: 13.8, algorithm_version: history.algorithm_version, source_manifest_sha256: history.source_manifest_sha256, limitations: [...history.limitations, ...stage.limitations] }); }
          let match = /^jobs\/(job_[a-f0-9]{32})$/.exec(routeName); if (match) { const job = jobs.get(match[1]); if (!job) fail(404, 'job_not_found'); return send(job); }
          match = /^comparisons\/(cmp_[a-f0-9]{24})\/manifest$/.exec(routeName); if (match) return send((await getResult(match[1])).result);
          match = /^evidence\/(ev_[a-f0-9]{32})\/export$/.exec(routeName);
          if (match) {
            const id = match[1], filename = path.join(state, 'evidence', id + '.json'); if (!fs.existsSync(filename)) fail(404, 'evidence_not_found'); const value = parse(fs.readFileSync(filename, 'utf8'));
            const format = q('format') || 'json'; if (!['json', 'csv'].includes(format)) fail(422, 'invalid_format');
            let raw;
            if (format === 'json') raw = fs.readFileSync(filename, 'utf8');
            else { const quote = text => '"' + String(text).replaceAll('"', '""') + '"'; raw = '\ufeffevidence_id,result_id,object_id,observation_id,comparison_sha256,judgment,frame_json\r\n' + value.comparison.frames.map(frame => [id, value.result_id, value.session.object_id, frame.observation_id, value.comparison_sha256, canonical(value.judgment), canonical(frame)].map(quote).join(',')).join('\r\n') + '\r\n'; }
            response.writeHead(200, { 'Content-Type': format === 'json' ? 'application/json' : 'text/csv', 'Content-Disposition': `attachment; filename="${id}.${format}"` }); return response.end(raw);
          }
          fail(404, 'not_found');
        }
        if (request.method !== 'POST') fail(405, 'method_not_allowed');
        const body = await readBody(request);
        if (routeName === 'mass-scenarios/calculate') { const input = checkSchema('MassScenarioInput', body); try { return send(massScenario(await snapshot('mass_scenarios', 'mass_scenario_source_unavailable'), input)); } catch (error) { if (error instanceof HTTPError) throw error; fail(422, 'invalid_mass_scenario'); } }
        if (routeName === 'comparison-jobs') {
          const input = checkSchema('ComparisonRequest', body); if (!pair(input.observation_ids)) fail(422, 'invalid_request');
          if (!sources.alive) fail(503, 'worker_unavailable'); if ([...jobs.values()].filter(j => ['queued', 'running'].includes(j.state)).length >= 8) fail(503, 'queue_full');
          const job = { schema_version: '1.0', job_id: 'job_' + uuid(), attempt_id: uuid(), observation_ids: input.observation_ids, object_id: input.observation_ids.includes('S12') ? 'pluto' : 'epsilon-indi-b', state: 'queued', stage: 'waiting', progress: 0, created_at: now(), result_id: null, error: null, cancel_requested: false };
          jobs.set(job.job_id, job); persist(job); send(job, 202); setImmediate(pump); return;
        }
        let match = /^jobs\/(job_[a-f0-9]{32})\/cancel$/.exec(routeName);
        if (match) { const job = jobs.get(match[1]); if (!job) fail(404, 'job_not_found'); if (['queued', 'running'].includes(job.state)) { job.cancel_requested = true; if (job.state === 'queued') { job.state = 'cancelled'; job.stage = 'cancelled'; } persist(job); } return send(job); }
        if (routeName === 'evidence') {
          const input = checkSchema('EvidenceRequest', body); try { sessionRules(input.session); } catch { fail(422, 'invalid_request'); }
          if ((await contextReasons(input.session)).length) fail(422, 'invalid_universe_context');
          const { record, result } = await getResult(input.result_id);
          if (result.frames.map(v => v.observation_id).join(',') !== input.session.observation_ids.join(',')) fail(409, 'selection_mismatch');
          const evidence = { schema_version: '1.0', evidence_id: 'ev_' + uuid(), created_at: now(), result_id: result.result_id, session: omitNullFields(input.session), judgment: input.judgment, comparison: result, comparison_sha256: record.comparison_sha256, ai_assistance: 'Code assisted by Codex; observations are original SPHEREx data.' };
          // Preserve Python's exact float spelling inside comparison. Replacing
          // 1.0 with 1 changes the existing Python schema-1 comparison digest.
          const raw = '{' + Object.keys(evidence).sort().map(key => JSON.stringify(key) + ':' + (key === 'comparison' ? record.raw : canonical(evidence[key]))).join(',') + '}';
          atomicRaw(path.join(state, 'evidence', evidence.evidence_id + '.json'), raw);
          response.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' }); return response.end(raw);
        }
        if (routeName === 'evidence/import') {
          const input = checkSchema('Evidence', body); try { sessionRules(input.session); } catch { fail(422, 'invalid_request'); }
          const ids = input.comparison.frames.map(v => v.observation_id);
          if (!pair(ids) || input.comparison.result_id !== input.result_id || input.comparison.object_id !== input.session.object_id || ids.join(',') !== input.session.observation_ids.join(',')) fail(409, 'selection_mismatch');
          const { record, result } = await comparisonFor(ids, false, true);
          if (record.comparison_sha256 !== input.comparison_sha256 || canonical(result) !== canonical(input.comparison)) fail(409, 'integrity_mismatch');
          const reasons = await contextReasons(input.session);
          if (record.source_validation_error) reasons.push(record.source_validation_error);
          try { await getResult(input.result_id); } catch (error) { reasons.push(error.status === 409 ? 'result_changed' : 'result_missing'); }
          return send({ status: reasons.length ? 'recalculation_required' : 'restored', reasons: [...new Set(reasons)].sort(), session: omitNullFields(input.session), comparison: reasons.length ? null : result, judgment: input.judgment, evidence_id: input.evidence_id });
        }
        fail(404, 'not_found');
      }
      if (!['GET', 'HEAD'].includes(request.method)) fail(405, 'method_not_allowed');
      let relative = pathname === '/' ? 'index.html' : decoded.slice(1);
      if (relative !== 'index.html' && !['assets/', 'textures/', 'observations/'].some(prefix => relative.startsWith(prefix))) fail(404, 'not_found');
      let file; try { file = safePath(path.join(root, 'web', 'dist'), relative); if (!fs.statSync(file).isFile()) throw new Error(); } catch { fail(404, 'not_found'); }
      if (relative.startsWith('textures/') || relative.startsWith('observations/')) { try { await sources.call('verify'); } catch { fail(503, 'source_unavailable'); } }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size });
      if (request.method === 'HEAD') return response.end(); fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      if (!response.headersSent) send({ code: error instanceof HTTPError ? error.message : 'internal_error', message_key: 'errors.' + (error instanceof HTTPError ? error.message : 'internal_error'), details: {}, request_id: requestId }, error.status || 500);
      else response.destroy();
    }
  }
  async function hierarchy(galaxy, parent) {
    const base = await snapshot('universe_catalog', 'universe_catalog_unavailable');
    if (galaxy && !base.galaxy_ids.includes(galaxy)) fail(422, 'unsupported_catalog_selection');
    let value = galaxy ? await snapshot('universe_catalog_galaxy_' + galaxy, 'universe_catalog_unavailable') : base;
    if (parent?.startsWith('host-')) {
      if (galaxy && galaxy !== 'galaxy-milky-way') fail(422, 'unsupported_catalog_selection');
      let children; try { children = await sources.call('dictionary_entry', { snapshot: 'universe_host_children', id: parent }); } catch { fail(503, 'universe_catalog_unavailable'); } if (!children) fail(422, 'unsupported_catalog_selection');
      return { ...value, galaxy_id: galaxy, parent_id: parent, objects: children };
    }
    if (parent) {
      if (parent === 'galaxy-milky-way' && !galaxy) value = await snapshot('universe_catalog_galaxy_galaxy-milky-way', 'universe_catalog_unavailable');
      const known = new Set(['solar-system', ...base.galaxy_ids, ...base.objects.map(v => v.object_id)]); if (!known.has(parent)) fail(422, 'unsupported_catalog_selection');
      const parentGalaxy = base.galaxy_ids.includes(parent) ? parent : parent === 'solar-system' ? 'galaxy-milky-way' : base.objects.find(v => v.object_id === parent)?.galaxy_id;
      if (galaxy && parentGalaxy !== galaxy) fail(422, 'unsupported_catalog_selection');
      value.objects = value.objects.filter(v => v.parent_id === parent);
    }
    return { ...value, galaxy_id: galaxy, parent_id: parent };
  }
  const server = http.createServer({ requestTimeout: 30000, headersTimeout: 15000, maxHeaderSize: 16384 }, route);
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  const close = async () => { if (closing) return; closing = true; await new Promise(resolve => server.close(resolve)); for (const job of jobs.values()) if (['queued', 'running'].includes(job.state)) { job.state = 'interrupted'; job.stage = 'shutdown'; persist(job); } await sources.close(); unlock(); };
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); } catch (error) { await sources.close(); unlock(); throw error; }
  getManifest().catch(() => {});
  if (!options.noSignals) for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { close().then(() => process.exit(0)); });
  console.log(`Planet X Node runtime listening on port ${server.address().port}`);
  return { server, close, state, sources };
}
module.exports = { start, HTTPError };

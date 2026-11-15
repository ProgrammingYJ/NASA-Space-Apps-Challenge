'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Sources } = require('./sources');
const { parse, canonical, hash, safePath, atomic, atomicRaw, lock } = require('./storage');
const { validator, sessionRules, resolveRegisteredPair, omitNullFields, migrateSolarSession, nativeTnoContextReasons } = require('./schema');
const { massScenario, longTerm, timelineScene, calendarMs, finite } = require('./science');
const { SOURCE_VERIFICATION_POLICY } = require('./verification-policy');
const { loadPresets, normalizeOrbit, skyPath } = require('./planet-nine');
const { gravityField, integrateParticle } = require('./solar-gravity');
const { coverageService } = require('./p9-coverage');
const { evidenceStore } = require('./p9-evidence');
const { createRegionCatalog } = require('./p9-regions');
const { createOuterCatalog } = require('./outer-tno');
const { resolveDisplayCompatibility } = require('./visual-compatibility');
const LIMIT = 8_000_000;
const uuid = () => crypto.randomUUID().replaceAll('-', '');
const now = () => new Date().toISOString();
class HTTPError extends Error { constructor(status, code) { super(code); this.status = status; } }
const fail = (status, code) => { throw new HTTPError(status, code); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
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
  const port = options.port ?? Number(process.env.PORT || process.env.APP_PORT || 3002), host = options.host || process.env.APP_HOST || '0.0.0.0';
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('invalid_port');
  const unlock = lock(state), sources = new Sources(root);
  const validate = validator(parse(fs.readFileSync(path.join(root, 'contracts/openapi.json'), 'utf8')));
  const p9Document = parse(fs.readFileSync(path.join(root, 'contracts/planet-nine.schema.json'), 'utf8'));
  const validateP9 = validator({ ...p9Document, components: { schemas: p9Document.$defs } });
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
  const p9Coverage = coverageService({ stateDir: state, normalizeOrbit, fetcher: options.mostFetcher });
  let regionCatalog;
  const p9Regions = () => { try { return regionCatalog || (regionCatalog = createRegionCatalog(root)); } catch { fail(503, 'hypothesis_source_unavailable'); } };
  let outerCatalog;
  const tnoCatalog = () => { try { return outerCatalog || (outerCatalog = createOuterCatalog(root)); } catch { fail(503, 'outer_tno_source_unavailable'); } };
  const p9Presets = () => { try { return loadPresets(root); } catch { fail(503, 'hypothesis_source_unavailable'); } };
  const p9Prediction = async input => skyPath(input, await snapshot('long_term_model', 'simulation_source_unavailable'));
  let gravityActive = false;
  const p9Gravity = async (kind, input, shouldCancel) => {
    if (kind === 'field') return gravityField(input, await snapshot('long_term_model', 'simulation_source_unavailable'));
    if (gravityActive) fail(503, 'gravity_busy');
    gravityActive = true;
    try { return await integrateParticle(input, await snapshot('long_term_model', 'simulation_source_unavailable'), { shouldCancel }); }
    finally { gravityActive = false; }
  };
  const validateRegion = async context => {
    await getManifest(); const catalog = p9Regions(), row = catalog.row(context.row_index);
    if (row.cell_id !== context.cell_id) return false;
    const input = { subset: context.subset, max_reference_distance_au: context.max_reference_distance_au, offset: 0, limit: 100 };
    do { const page = catalog.members(context.cell_id, input); if (page.rows.includes(context.row_index)) return true; input.offset = page.next_offset; } while (input.offset !== null);
    return false;
  };
  const p9Evidence = evidenceStore({ stateDir: state, normalizeOrbit, predict: p9Prediction, presets: p9Presets, populationRow: async index => { await getManifest(); return p9Regions().row(index); }, validateRegion, coverage: p9Coverage, gravity: p9Gravity });
  const checkSchema = (name, value) => { try { return validate(name, value); } catch { fail(422, 'invalid_request'); } };
  const checkP9 = (name, value) => { try { return validateP9(name, value); } catch { fail(422, 'invalid_planet_nine_request'); } };
  const observationRegistry = async (forImport = false) => { try { return await sources.call(forImport ? 'importRegistry' : 'registry'); } catch { fail(503,'source_unavailable'); } };
  const selectionFor = async (ids, objectId, forImport = false) => { const registry = await observationRegistry(forImport); try { return resolveRegisteredPair(registry,ids,objectId); } catch { fail(422,'invalid_request'); } };
  async function comparisonFor(ids, strong = false, forImport = false) {
    try {
      const record = await sources.call(forImport ? 'importComparison' : 'comparison', ids.join(','), strong);
      const result = parse(record.raw);
      if (!/^cmp_[a-f0-9]{24}$/.test(result.result_id) || result.object_id !== record.object_id || result.algorithm_version !== record.algorithm_version || result.frames.map(v => v.observation_id).join(',') !== ids.join(',') || hash(record.raw) !== record.comparison_sha256) throw new Error('comparison_integrity');
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
    if (c.simulation_context) keys.push('long_term_model');
    try { m = await manifestMetadata(); values = await sources.call('snapshots', keys); } catch { return ['universe_ephemeris_unavailable']; }
    const hashes = new Map(m.source_files.map(f => [f.path, f.sha256]));
    const epoch = Date.parse(c.model_epoch), timeline = values.timeline;
    if (!timeline || !/(Z|[+-]\d\d:\d\d)$/.test(c.model_epoch) || !finite(epoch, Date.parse(timeline.start_epoch), Date.parse(timeline.end_epoch))) return ['unsupported_model_epoch'];
    if (c.timeline_algorithm_version !== 'display-hermite-v1' && !timeline.knots.some(k => Date.parse(k.epoch) === epoch)) return ['unsupported_model_epoch'];
    if (!c.timeline_algorithm_version && c.orbit_manifest_sha256 && epoch !== Date.parse(timeline.default_epoch)) return ['orbit_guide_reference_changed'];
    const fields = [ ['source_manifest_sha256', 'solar_system_ephemeris.json', 'universe_ephemeris_changed'], ['orbit_manifest_sha256', 'solar_system_orbits.json', 'orbit_ephemeris_changed'], ['appearance_manifest_sha256', 'appearance.json', 'appearance_sources_changed'], ['small_body_appearance_manifest_sha256', 'small_body_appearance.json', 'small_body_appearance_sources_changed'], ['planet_criteria_manifest_sha256', 'planet_criteria.json', 'planet_criteria_sources_changed'], ['mass_scenarios_manifest_sha256', 'mass_scenarios.json', 'mass_scenario_sources_changed'], ['extended_solar_manifest_sha256', 'extended_solar.json', 'extended_solar_sources_changed'] ];
    for (const [field, name, reason] of fields) if (c[field] && hashes.get('data/manifests/' + name) !== c[field]) return [reason];
    if (c.outer_tno_manifest_sha256 != null || c.native_tno_simulation_algorithm_version != null) {
      let current; try { current = tnoCatalog().catalog(); } catch { return ['outer_tno_data_unavailable']; }
      const reasons = nativeTnoContextReasons(c, current); if (reasons.length) return reasons;
    }
    if (c.mass_scenario) { try { massScenario(values.mass_scenarios, c.mass_scenario); } catch { return ['mass_scenario_data_unavailable']; } }
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
        // Explicit tombstones preserve the scope change without retaining the
        // removed catalog, laboratory or historical feature implementations.
        const removedScope = /^(?:black-holes|observer-physics|cosmic-history|cosmic-observations|physics|catalog\/(?:galaxies|galaxy-atlas|exoplanets|exoplanet-observations|extragalactic-planets|universe|comets))(?:\/|$)/.test(routeName);
        if (removedScope) fail(410, 'outside_1000au_scope');
        if (request.method === 'GET') {
          if (routeName === 'planet-nine/presets') { try { return send(await p9Presets()); } catch { fail(503, 'hypothesis_source_unavailable'); } }
          if (routeName === 'planet-nine/regions' || routeName === 'planet-nine/regions/summary' || /^planet-nine\/regions\/\d+\/members$/.test(routeName) || /^planet-nine\/population\/\d+$/.test(routeName)) {
            const allowed = new Set(['subset', 'max_reference_distance_au', 'offset', 'limit']);
            if ([...url.searchParams.keys()].some(key => !allowed.has(key))) fail(422, 'invalid_region_selection');
            const input = {};
            if (q('subset') !== null) input.subset = q('subset');
            if (q('max_reference_distance_au') !== null) input.max_reference_distance_au = q('max_reference_distance_au') === 'null' ? null : queryNumber(url, 'max_reference_distance_au');
            for (const key of ['offset', 'limit']) if (q(key) !== null) input[key] = queryNumber(url, key, undefined, true);
            try {
              await getManifest();
              const catalog = p9Regions();
              if (routeName === 'planet-nine/regions/summary') return send(catalog.summary(input));
              if (routeName === 'planet-nine/regions') return send(catalog.regions(input));
              const member = /^planet-nine\/regions\/(\d+)\/members$/.exec(routeName);
              if (member) return send(catalog.members(Number(member[1]), input));
              if (Object.keys(input).length) fail(422, 'invalid_region_selection');
              return send(catalog.row(Number(routeName.split('/').at(-1))));
            } catch (error) { if (error instanceof HTTPError) throw error; fail(error.status || 422, error.status ? error.message : 'invalid_region_selection'); }
          }
          const p9Export = /^planet-nine\/evidence\/(p9ev_[a-f0-9]{32})\/export$/.exec(routeName);
          if (p9Export) {
            let raw; try { raw = p9Evidence.raw(p9Export[1]); } catch (error) { fail(error.status || 503, error.status ? error.message : 'evidence_unavailable'); }
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${p9Export[1]}.json"` }); return response.end(raw);
          }
          if (routeName === 'runtime') { const m = await getManifest().catch(() => fail(503, 'source_unavailable')); return send({ schema_version: '1.0', runtime: 'node', public_scope: 'solar_system_1000au', feature_flags: { galaxies: false, galaxy_atlas: false, exoplanets: false, black_holes: false, cosmic_history: false, historical_comets: false, physics_lab: false, observer_experiment: false, planet_nine_hypothesis: true }, physics_capabilities: { hypothesis: 'p9-kepler-sky-v1', gravity: 'newtonian_prescribed_sun_and_eight_planets_restricted_test_particle', optional_solar_1pn: true, all_physics: false, all_bodies_known: false, study_radius_au: 1000, force_cutoff_au: null, max_integrator_steps: 4096 }, observation_processing: 'verified_build_cache', snapshot_exported_utc: m.exported_utc, supported_observation_pairs: m.selection_contract?.comparison_pairs ?? [['S01', 'S02'], ['S12', 'S14']], ordered_comparison_count: Object.keys(m.comparisons).length, arbitrary_fits_inputs: false, source_verification_policy: SOURCE_VERIFICATION_POLICY }); }
          const fixed = { objects: ['objects'], timeline: ['timeline'], appearance: ['appearance', 'appearance_unavailable'], 'small-body-appearance': ['small_body_appearance', 'small_body_appearance_unavailable'], 'mass-scenarios': ['mass_scenarios', 'mass_scenario_source_unavailable'], 'kuiper-belt': ['kuiper_belt'], 'long-term-model': ['long_term_model', 'simulation_source_unavailable'] };
          if (fixed[routeName]) return send(await snapshot(...fixed[routeName]));
          if (routeName === 'universe') { const scene = await snapshot('universe'), timeline = await snapshot('timeline'); try { return send(timelineScene(scene, timeline, q('epoch') ?? timeline.default_epoch)); } catch { fail(422, 'unsupported_model_epoch'); } }
          if (routeName === 'long-term-simulation') { try { return send(longTerm(await snapshot('long_term_model', 'simulation_source_unavailable'), queryNumber(url, 'year', undefined, true), queryNumber(url, 'month', 1, true), queryNumber(url, 'day', 1, true), queryNumber(url, 'hour', 0))); } catch (error) { if (error instanceof HTTPError) throw error; fail(422, 'unsupported_simulation_date'); } }
          if (routeName === 'observations') {
            const id = q('object_id') || 'epsilon-indi-b', m = await getManifest();
            if (m.snapshots['observations_' + id]) return send(await snapshot('observations_' + id));
            const solar = await snapshot('solar_system', 'catalog_unavailable'), base = await snapshot('universe');
            if (!base.objects.some(object => object.object_id === id) && !solar.objects.some(object => object.object_id === id) && !tnoCatalog().catalog().objects.some(object => object.object_id === id)) fail(404, 'object_not_found');
            return send({ object_id: id, observations: [], status: 'no_linked_observations', next_cursor: null });
          }
          if (routeName === 'planet-criteria') { const value = await snapshot('planet_criteria', 'planet_criteria_unavailable'), id = q('object_id'); if (id !== null) { if (!Object.hasOwn(value.objects, id)) fail(422, 'unsupported_planet_criteria_object'); value.objects = { [id]: value.objects[id] }; value.object_filter = id; } return send(value); }
          if (routeName === 'catalog/solar-system') { const id = q('parent_id'); if (id === null) return send(await snapshot('solar_system', 'catalog_unavailable')); const m = await getManifest(); if (!m.snapshots['solar_parent_' + id]) fail(422, 'unknown_extended_parent'); return send(await snapshot('solar_parent_' + id, 'catalog_unavailable')); }
          if (['catalog/outer-tno', 'catalog/outer-tno/scene', 'catalog/outer-tno/object'].includes(routeName)) {
            await getManifest(); const catalog = tnoCatalog();
            try {
              if (routeName === 'catalog/outer-tno') { if ([...url.searchParams.keys()].length) fail(422, 'invalid_outer_tno_selection'); return send(catalog.catalog()); }
              const allowed = routeName.endsWith('/object') ? ['object_id', 'jd_tdb'] : ['jd_tdb'];
              if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) fail(422, 'invalid_outer_tno_selection');
              const jd = queryNumber(url, 'jd_tdb', catalog.catalog().reference_jd_tdb);
              if (routeName.endsWith('/scene')) return send(catalog.scene(jd));
              if (!q('object_id')) fail(422, 'invalid_outer_tno_selection');
              return send(catalog.object(q('object_id'), jd));
            } catch (error) { if (error instanceof HTTPError) throw error; fail(error.status || 422, error.status ? error.message : 'invalid_outer_tno_selection'); }
          }
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
        if (routeName.startsWith('planet-nine/')) {
          try {
            if (routeName === 'planet-nine/predict') return send(await p9Prediction(checkP9('PredictionInput', body)));
            if (routeName === 'planet-nine/gravity-field') return send(await p9Gravity('field', checkP9('GravityFieldInput', body)));
            if (routeName === 'planet-nine/integrate') return send(await p9Gravity('integration', checkP9('IntegrationInput', body), () => response.destroyed || closing));
            if (routeName === 'planet-nine/coverage') return send(await p9Coverage.query(checkP9('CoverageInput', body)));
            if (routeName === 'planet-nine/evidence') return send(await p9Evidence.save(checkP9('EvidenceRequest', body)), 201);
            if (routeName === 'planet-nine/evidence/import') return send(await p9Evidence.restore(checkP9('EvidenceEnvelope', body)));
          } catch (error) { if (error instanceof HTTPError) throw error; fail(error.status || 500, error.status ? error.message : 'planet_nine_unavailable'); }
          fail(404, 'not_found');
        }
        if (routeName === 'mass-scenarios/calculate') { const input = checkSchema('MassScenarioInput', body); try { return send(massScenario(await snapshot('mass_scenarios', 'mass_scenario_source_unavailable'), input)); } catch (error) { if (error instanceof HTTPError) throw error; fail(422, 'invalid_mass_scenario'); } }
        if (routeName === 'comparison-jobs') {
          const input = checkSchema('ComparisonRequest', body), selection = await selectionFor(input.observation_ids);
          if (!sources.alive) fail(503, 'worker_unavailable'); if ([...jobs.values()].filter(j => ['queued', 'running'].includes(j.state)).length >= 8) fail(503, 'queue_full');
          const job = { schema_version: '1.0', job_id: 'job_' + uuid(), attempt_id: uuid(), observation_ids: input.observation_ids, object_id: selection.object_id, algorithm_version: selection.algorithm_version, state: 'queued', stage: 'waiting', progress: 0, created_at: now(), result_id: null, error: null, cancel_requested: false };
          jobs.set(job.job_id, job); persist(job); send(job, 202); setImmediate(pump); return;
        }
        let match = /^jobs\/(job_[a-f0-9]{32})\/cancel$/.exec(routeName);
        if (match) { const job = jobs.get(match[1]); if (!job) fail(404, 'job_not_found'); if (['queued', 'running'].includes(job.state)) { job.cancel_requested = true; if (job.state === 'queued') { job.state = 'cancelled'; job.stage = 'cancelled'; } persist(job); } return send(job); }
        if (routeName === 'evidence') {
          const input = checkSchema('EvidenceRequest', body), registry = await observationRegistry(); try { sessionRules(input.session,registry); } catch { fail(422, 'invalid_request'); }
          const migration = migrateSolarSession(input.session);
          if (migration.omitted_contexts.length) fail(422, 'removed_context_requires_import');
          input.session = migration.session;
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
          const input = checkSchema('Evidence', body), registry = await observationRegistry(true); try { sessionRules(input.session,registry); } catch { fail(422, 'invalid_request'); }
          const ids = input.comparison.frames.map(v => v.observation_id);
          try { resolveRegisteredPair(registry,ids,input.session.object_id); } catch { fail(409,'selection_mismatch'); }
          if (input.comparison.result_id !== input.result_id || input.comparison.object_id !== input.session.object_id || ids.join(',') !== input.session.observation_ids.join(',')) fail(409, 'selection_mismatch');
          const { record, result } = await comparisonFor(ids, false, true);
          if (record.comparison_sha256 !== input.comparison_sha256 || canonical(result) !== canonical(input.comparison)) fail(409, 'integrity_mismatch');
          const currentMetadata = await manifestMetadata();
          const visualFiles={appearance_manifest_sha256:'appearance.json',small_body_appearance_manifest_sha256:'small_body_appearance.json',mass_scenarios_manifest_sha256:'mass_scenarios.json'};
          const visualHashes=Object.fromEntries(Object.entries(visualFiles).map(([field,file])=>[field,currentMetadata.source_files.find(row=>row.path==='data/manifests/'+file)?.sha256]));
          const compatibleReferences=[];
          for(const field of ['small_body_appearance_manifest_sha256','mass_scenarios_manifest_sha256']) {
            const from=input.session.universe_context?.[field],to=visualHashes[field];
            if(from&&to&&from!==to){const verified=resolveDisplayCompatibility(root,field,from,to);if(verified)compatibleReferences.push(verified);}
          }
          const migration = migrateSolarSession(input.session,visualHashes,compatibleReferences), reasons = await contextReasons(migration.session);
          if (record.source_validation_error) reasons.push(record.source_validation_error);
          const comparisonPath = path.join(state, 'comparisons', input.result_id + '.json');
          if (fs.existsSync(comparisonPath) && hash(fs.readFileSync(comparisonPath)) !== record.comparison_sha256) reasons.push('result_changed');
          if (!reasons.length) {
            if (!fs.existsSync(comparisonPath)) atomicRaw(comparisonPath, record.raw);
            const evidencePath = path.join(state, 'evidence', input.evidence_id + '.json');
            // Keep the original envelope and comparison digest. Only the
            // returned active session is migrated; exports retain old context.
            const raw = '{' + Object.keys(body).sort().map(key => JSON.stringify(key) + ':' + (key === 'comparison' ? record.raw : canonical(body[key]))).join(',') + '}';
            if (fs.existsSync(evidencePath)) { if (canonical(parse(fs.readFileSync(evidencePath, 'utf8'))) !== canonical(body)) fail(409, 'evidence_id_collision'); }
            else atomicRaw(evidencePath, raw);
          }
          return send({ response_schema_version: '1.1', status: reasons.length ? 'recalculation_required' : migration.omitted_contexts.length ? 'partially_restored' : 'restored', restoration_scope: 'observation_and_solar_system', migration_policy: 'solar-scope-context-v1', omitted_contexts: migration.omitted_contexts, reasons: [...new Set(reasons)].sort(), session: omitNullFields(migration.session), comparison: reasons.length ? null : result, judgment: input.judgment, evidence_id: input.evidence_id });
        }
        fail(404, 'not_found');
      }
      if (!['GET', 'HEAD'].includes(request.method)) fail(405, 'method_not_allowed');
      let relative = pathname === '/' ? 'index.html' : decoded.slice(1);
      if (relative !== 'index.html' && !['assets/', 'textures/', 'brand/', 'reference/', 'downloads/'].some(prefix => relative.startsWith(prefix))) fail(404, 'not_found');
      let file; try { file = safePath(path.join(root, 'web', 'dist'), relative); if (!fs.statSync(file).isFile()) throw new Error(); } catch { fail(404, 'not_found'); }
      if (['textures/', 'brand/', 'reference/', 'downloads/'].some(prefix => relative.startsWith(prefix))) { try { await sources.call('asset', relative); } catch { fail(503, 'source_unavailable'); } }
      const downloadHeaders = relative === 'downloads/PlanetX_Data_Spec.pdf' ? { 'Content-Disposition': 'attachment; filename="PlanetX_Data_Spec.pdf"', 'Cache-Control': 'no-cache' } : {};
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, ...downloadHeaders });
      if (request.method === 'HEAD') return response.end(); fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      if (!response.headersSent) send({ code: error instanceof HTTPError ? error.message : 'internal_error', message_key: 'errors.' + (error instanceof HTTPError ? error.message : 'internal_error'), details: {}, request_id: requestId }, error.status || 500);
      else response.destroy();
    }
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

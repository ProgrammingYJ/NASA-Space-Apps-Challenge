'use strict';
// IRSA MOST predicts image footprint overlap. It does not detect a source.
const fs = require('node:fs');
const path = require('node:path');
const { canonical, hash, atomic, parse } = require('./storage');
const ENDPOINT = 'https://irsa.ipac.caltech.edu/cgi-bin/MOST/nph-most';
const VERSION = 'p9-coverage-1';
const MAX_BYTES = 2_000_000, MAX_ROWS = 2500, MAX_DAYS = 31;
const LIMITATIONS = [
  'Predicted image footprint overlap is not detection, measured motion, or evidence of Planet Nine existence.',
  'MOST observer position and source time-scale conventions have not been independently verified for SPHEREx.',
  'A successful empty result means no overlap in this query and indexed release; it does not imply physical absence.',
  'MOST orbit calculation is independent of the local two-body prediction; source and observer differences are retained.',
  'Archive links may expire or change. The original response is saved with its SHA256 for reproducibility.'
];
function invalid(code = 'invalid_coverage_request') { const error = new Error(code); error.status = 422; throw error; }
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) invalid();
}
function date(value) {
  if (typeof value !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(value)) invalid();
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value || ms < Date.parse('2025-01-01T00:00:00Z') || ms > Date.parse('2030-12-31T00:00:00Z')) invalid();
  return ms;
}
function makeQuery(input, normalizeOrbit) {
  keys(input, ['orbit', 'start_date', 'end_date', 'known_object']);
  const lo = date(input.start_date), hi = date(input.end_date);
  if (hi < lo || (hi - lo) / 86400000 >= MAX_DAYS) invalid('coverage_date_range_too_large');
  const common = { catalog: 'spherex', obs_begin: input.start_date.replaceAll('-', ' ') + ' 00:00:00', obs_end: input.end_date.replaceAll('-', ' ') + ' 23:59:59', output_mode: 'Brief' };
  if (input.known_object !== undefined) {
    if (input.known_object !== 'pluto' || input.orbit !== undefined) invalid();
    return { ...common, input_type: 'naifid_input', obj_naifid: '999' };
  }
  const o = normalizeOrbit(input.orbit);
  return { ...common, input_type: 'manual_input', obj_type: 'Asteroid', body_designation: 'PlanetXHypothesis', epoch: String(o.epoch_jd_tdb - 2400000.5), semimajor_axis: String(o.a_au), eccentricity: String(o.e), inclination: String(o.i_deg), arg_perihelion: String(o.omega_deg), ascend_node: String(o.Omega_deg), mean_anomaly: String(o.M_deg) };
}
function allowedArchiveLink(uri) {
  if (typeof uri !== 'string' || !uri || uri.includes('\\') || uri.split('/').includes('..')) return null;
  try {
    const u = new URL(uri, 'https://irsa.ipac.caltech.edu/');
    return u.protocol === 'https:' && u.hostname === 'irsa.ipac.caltech.edu' && u.port === '' && !u.username && !u.password && u.pathname.startsWith('/ibe/data/spherex/') ? u.href : null;
  } catch { return null; }
}
function readTable(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BYTES) throw new Error('most_response_too_large');
  const lines = raw.split(/\r?\n/), first = lines.findIndex(v => v.startsWith('|'));
  if (lines.some(line => /^\\error\b/i.test(line) || /^\\status\s*=.*(?:error|failed)/i.test(line))) throw new Error('most_service_error');
  // Do not interpret a service error or HTML response as a successful empty table.
  if (first < 0) {
    if (/\b(?:no\s+(?:matching\s+)?(?:images|records|matches)|no\s+data\s+found)\b/i.test(raw) && !/<html|<error|\bERROR\b/i.test(raw)) return [];
    throw new Error('most_unrecognized_response');
  }
  const header = lines[first], boundaries = [...header.matchAll(/\|/g)].map(v => v.index), names = boundaries.slice(0, -1).map((x, i) => header.slice(x + 1, boundaries[i + 1]).trim());
  if (!names.includes('observationid') || !names.includes('uri') || !names.some(n => ['ra_obj', 'ra_obs'].includes(n))) throw new Error('most_table_schema_changed');
  const rows = [];
  for (const line of lines.slice(first + 1)) {
    if (!line.trim() || line.startsWith('|') || line.startsWith('\\')) continue;
    if (/<html|<error|\bERROR\b/i.test(line)) throw new Error('most_service_error');
    if (rows.length >= MAX_ROWS) throw new Error('most_too_many_rows');
    const metadata = Object.fromEntries(names.map((name, i) => [name, line.slice(boundaries[i], boundaries[i + 1]).trim()]));
    const number = name => { const v = metadata[name]; return v && /^[-+]?\d*(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(v) && Number.isFinite(Number(v)) ? Number(v) : null; };
    const ra = number(names.includes('ra_obj') ? 'ra_obj' : 'ra_obs'), dec = number(names.includes('dec_obj') ? 'dec_obj' : 'dec_obs');
    if (names.includes('match') && number('match') !== 1) throw new Error('most_unmatched_row_not_accepted');
    if (!metadata.observationid || metadata.observationid.length > 300 || ra === null || dec === null || ra < 0 || ra >= 360 || dec < -90 || dec > 90) throw new Error('most_invalid_row');
    const detector = /^D[1-6]$/.test(metadata.productid) ? metadata.productid : /^D[1-6]$/.test(metadata.instrument) ? metadata.instrument : null;
    rows.push({ observation_id: metadata.observationid, detector, observation_start_utc: metadata.start_date || null, observation_end_utc: metadata.end_date || null, ra_deg: ra, dec_deg: dec, uri: metadata.uri || null, original_url: allowedArchiveLink(metadata.uri), metadata });
  }
  return rows;
}
async function requestText(url, fetcher, signal) {
  const response = await fetcher(url, { signal, redirect: 'error', headers: { Accept: 'text/plain', 'User-Agent': 'PlanetX-SPHEREx/0.12 scientific-coverage' } });
  if (!response.ok) { const error = new Error('most_http_error'); error.http_status = response.status; throw error; }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('most_response_too_large');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > MAX_BYTES) throw new Error('most_response_too_large'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return { raw: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), metadata: { http_status: response.status, content_type: response.headers.get('content-type'), content_encoding: response.headers.get('content-encoding'), representation: 'decoded_UTF8_response_body' } };
}
function coverageService(options) {
  const { stateDir, normalizeOrbit } = options, fetcher = options.fetcher || fetch;
  const directory = path.join(stateDir, 'p9-coverage'); fs.mkdirSync(directory, { recursive: true });
  const pending = new Map(); let active = 0;
  const cacheFile = key => path.join(directory, key + '.json');
  function verify(value) {
    if (!value || value.schema_version !== VERSION || !/^p9cov_[a-f0-9]{24}$/.test(value.coverage_id) || value.source_url !== ENDPOINT || typeof value.raw_response !== 'string' || Buffer.byteLength(value.raw_response) > MAX_BYTES || hash(value.raw_response) !== value.response_sha256 || !['coverage_available', 'no_coverage', 'service_error'].includes(value.status) || value.query?.catalog !== 'spherex' || value.observer !== 'MOST_observer_not_verified' || value.claim !== 'predicted_footprint_overlap_only' || !Number.isFinite(Date.parse(value.queried_at))) throw new Error('coverage_integrity_mismatch');
    if (value.coverage_id !== 'p9cov_' + hash(canonical(value.query)).slice(0, 24)) throw new Error('coverage_integrity_mismatch');
    if (value.status === 'service_error' && (value.row_count !== 0 || !Array.isArray(value.rows) || value.rows.length !== 0 || !value.error || typeof value.error.code !== 'string')) throw new Error('coverage_integrity_mismatch');
    if (value.status !== 'service_error') {
      const rows = readTable(value.raw_response);
      if (canonical(rows) !== canonical(value.rows) || rows.length !== value.row_count || value.status !== (rows.length ? 'coverage_available' : 'no_coverage')) throw new Error('coverage_integrity_mismatch');
    }
    return value;
  }
  async function query(input) {
    const params = makeQuery(input, normalizeOrbit), key = hash(canonical(params)), filename = cacheFile(key);
    if (fs.existsSync(filename)) {
      try { const cached = verify(parse(fs.readFileSync(filename, 'utf8'))); if (Date.now() - Date.parse(cached.queried_at) < 86400000 && cached.status !== 'service_error') return { ...cached, cache_hit: true }; } catch {}
    }
    if (pending.has(key)) return pending.get(key);
    if (active >= 2) { const error = new Error('coverage_busy'); error.status = 503; throw error; }
    const run = (async () => {
      active++;
      const url = new URL(ENDPOINT); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      let raw = '', rows = [], failure = null, responseMetadata = null;
      try { const response = await requestText(url, fetcher, AbortSignal.timeout(25000)); raw = response.raw; responseMetadata = response.metadata; rows = readTable(raw); }
      catch (error) { failure = { code: error.name === 'TimeoutError' || error.name === 'AbortError' ? 'most_timeout' : error.message || 'most_unavailable', http_status: error.http_status || null }; }
      const value = { schema_version: VERSION, coverage_id: 'p9cov_' + key.slice(0, 24), status: failure ? 'service_error' : rows.length ? 'coverage_available' : 'no_coverage', query: params, queried_at: new Date().toISOString(), cache_hit: false, response_sha256: hash(raw), raw_response: raw, response_metadata: responseMetadata, rows, row_count: rows.length, observer: 'MOST_observer_not_verified', claim: 'predicted_footprint_overlap_only', error: failure, source_url: ENDPOINT, limitations: LIMITATIONS };
      if (!failure) atomic(filename, value);
      return value;
    })().finally(() => { active--; pending.delete(key); });
    pending.set(key, run); return run;
  }
  function verifyForSave(value) {
    verify(value);
    if (value.status === 'service_error') return value;
    const key = hash(canonical(value.query)), filename = cacheFile(key);
    if (!fs.existsSync(filename)) throw new Error('coverage_not_queried_on_this_server');
    const saved = verify(parse(fs.readFileSync(filename, 'utf8')));
    if (saved.response_sha256 !== value.response_sha256 || canonical(saved.query) !== canonical(value.query)) throw new Error('coverage_integrity_mismatch');
    return saved;
  }
  return { query, verify, verifyForSave };
}
module.exports = { coverageService, makeQuery, readTable, allowedArchiveLink, ENDPOINT, VERSION, LIMITATIONS };

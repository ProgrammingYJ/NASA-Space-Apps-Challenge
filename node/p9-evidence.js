'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonical, hash, atomic, parse, strict } = require('./storage');
const VERSION = 'planet-nine-evidence-1';
const KIND = 'planet_nine_hypothesis_coverage';
const LIMITATIONS = [
  'This is a conditional hypothesis and footprint-coverage record, not detection or proof of Planet Nine.',
  'SHA256 verifies saved content integrity, not the authenticity of externally supplied imports.',
  'Stored archive responses are preserved snapshots. They do not establish current archive availability.',
  'Actual SPHEREx image measurements and their evidence remain in the separate observation evidence workflow.',
  'Optional gravity results use a bounded restricted test-particle model with declared sources and omitted forces; they do not reproduce all physics or unknown bodies.'
];
function error(code = 'invalid_planet_nine_evidence', status = 422) { const e = new Error(code); e.status = status; throw e; }
function object(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !(k in value))) error();
}
function modelCalendarLabel(jd) {
  if (typeof jd !== 'number' || !Number.isFinite(jd)) error('invalid_prediction_date');
  const date = new Date(Math.round((jd - 2440587.5) * 86400000));
  if (!Number.isFinite(date.getTime())) error('invalid_prediction_date');
  // Calendar-label arithmetic for the UI's TDB assumption. Date's Gregorian
  // formatter does not perform or establish a precise TDB-to-UTC conversion.
  return date.toISOString().slice(0, 10);
}
function selectionDates(value) {
  const request = value.prediction.request;
  if (value.coverage) {
    const begin = modelCalendarLabel(request.start_jd_tdb).replaceAll('-', ' ') + ' 00:00:00';
    const end = modelCalendarLabel(request.end_jd_tdb).replaceAll('-', ' ') + ' 23:59:59';
    if (value.coverage.query.obs_begin !== begin || value.coverage.query.obs_end !== end) error('coverage_date_selection_mismatch', 409);
  }
  if (value.gravity) {
    const gravity = value.gravity.result.request;
    const epoch = value.gravity.kind === 'field' ? gravity.jd_tdb : gravity.start_jd_tdb;
    if (epoch !== request.start_jd_tdb) error('gravity_date_selection_mismatch', 409);
  }
}
function evidenceStore(options) {
  const { stateDir, normalizeOrbit, predict, presets, populationRow, validateRegion, coverage, gravity } = options;
  async function currentRow(source) {
    if (populationRow) { const row = await populationRow(source.row_index); return { row, sha256: row.source_sha256 }; }
    const current = await presets(); return { row: current.presets.find(item => item.id === source.preset_id && item.row_index === source.row_index), sha256: current.source.sha256 };
  }
  const directory = path.join(stateDir, 'p9-evidence'); fs.mkdirSync(directory, { recursive: true });
  function validatePayload(value) {
    object(value, ['orbit', 'prediction', 'coverage', 'gravity', 'judgment', 'locale', 'source', 'region_context'], ['orbit', 'prediction']);
    const orbit = normalizeOrbit(value.orbit);
    if (!value.prediction || typeof value.prediction !== 'object' || !value.prediction.request || canonical(normalizeOrbit(value.prediction.request.orbit)) !== canonical(orbit)) error('hypothesis_selection_mismatch', 409);
    if (typeof value.judgment !== 'string' || value.judgment.length > 12000 || !['ko', 'en', 'ja', 'zh-Hant', 'fr'].includes(value.locale)) error();
    if (value.source != null) {
      object(value.source, ['preset_id', 'row_index', 'source_sha256'], ['preset_id', 'row_index', 'source_sha256']);
      if (!/^caltech-row-\d{1,5}$/.test(value.source.preset_id) || !Number.isInteger(value.source.row_index) || value.source.row_index < 0 || value.source.row_index > 99999 || value.source.preset_id !== 'caltech-row-' + value.source.row_index || !/^[a-f0-9]{64}$/.test(value.source.source_sha256)) error();
    }
    if (value.region_context != null) {
      const region = value.region_context;
      object(region, ['subset', 'max_reference_distance_au', 'cell_id', 'row_index'], ['subset', 'max_reference_distance_au', 'cell_id', 'row_index']);
      if (!['all', 'ztf', 'ztf_des', 'ztf_des_ps1'].includes(region.subset) || ![null, 1000].includes(region.max_reference_distance_au) || !Number.isInteger(region.cell_id) || region.cell_id < 0 || region.cell_id >= 12288 || !value.source || region.row_index !== value.source.row_index) error('invalid_region_context');
    }
    if (value.coverage != null) {
      try { coverage.verify(value.coverage); } catch { error('coverage_integrity_mismatch', 409); }
      const q = value.coverage.query;
      const fields = { semimajor_axis: orbit.a_au, eccentricity: orbit.e, inclination: orbit.i_deg, arg_perihelion: orbit.omega_deg, ascend_node: orbit.Omega_deg, mean_anomaly: orbit.M_deg, epoch: orbit.epoch_jd_tdb - 2400000.5 };
      if (q.input_type !== 'manual_input' || Object.entries(fields).some(([k, n]) => Number(q[k]) !== n)) error('hypothesis_selection_mismatch', 409);
    }
    if (value.gravity != null) {
      object(value.gravity, ['kind', 'result'], ['kind', 'result']);
      if (!['field', 'integration'].includes(value.gravity.kind) || !value.gravity.result?.request) error();
      if (value.gravity.kind === 'integration' && canonical(normalizeOrbit(value.gravity.result.request.orbit)) !== canonical(orbit)) error('hypothesis_selection_mismatch', 409);
      if (value.gravity.kind === 'field' && value.gravity.result.request.hypothesis && canonical(normalizeOrbit(value.gravity.result.request.hypothesis)) !== canonical(orbit)) error('hypothesis_selection_mismatch', 409);
    }
    return strict({ orbit, prediction: value.prediction, coverage: value.coverage || null, gravity: value.gravity || null, judgment: value.judgment, locale: value.locale, source: value.source || null, region_context: value.region_context || null });
  }
  async function save(input) {
    const payload = validatePayload(input); selectionDates(payload);
    const actual = await predict(payload.prediction.request);
    if (canonical(actual) !== canonical(payload.prediction)) error('prediction_integrity_mismatch', 409);
    if (payload.gravity) {
      if (!gravity || canonical(await gravity(payload.gravity.kind, payload.gravity.result.request)) !== canonical(payload.gravity.result)) error('gravity_integrity_mismatch', 409);
    }
    if (payload.coverage) { try { payload.coverage = coverage.verifyForSave(payload.coverage); } catch { error('coverage_integrity_mismatch', 409); } }
    if (payload.source) {
      const current = await currentRow(payload.source), row = current.row;
      if (current.sha256 !== payload.source.source_sha256 || !row || row.id !== payload.source.preset_id || canonical(normalizeOrbit(row.orbit)) !== canonical(payload.orbit)) error('hypothesis_source_changed', 409);
    }
    if (payload.region_context && (!validateRegion || !await validateRegion(payload.region_context))) error('region_context_changed', 409);
    const value = { schema_version: VERSION, kind: KIND, evidence_id: 'p9ev_' + crypto.randomUUID().replaceAll('-', ''), created_at: new Date().toISOString(), payload, payload_sha256: hash(canonical(payload)), limitations: LIMITATIONS };
    atomic(path.join(directory, value.evidence_id + '.json'), value); return value;
  }
  function raw(id) {
    if (!/^p9ev_[a-f0-9]{32}$/.test(id)) error('evidence_not_found', 404);
    const filename = path.join(directory, id + '.json');
    if (!fs.existsSync(filename)) error('evidence_not_found', 404);
    const raw = fs.readFileSync(filename, 'utf8'), value = parse(raw); validateEnvelope(value);
    if (value.evidence_id !== id) error('evidence_integrity_mismatch', 409); return raw;
  }
  function validateEnvelope(value) {
    object(value, ['schema_version', 'kind', 'evidence_id', 'created_at', 'payload', 'payload_sha256', 'limitations'], ['schema_version', 'kind', 'evidence_id', 'created_at', 'payload', 'payload_sha256', 'limitations']);
    if (value.schema_version !== VERSION || value.kind !== KIND || !/^p9ev_[a-f0-9]{32}$/.test(value.evidence_id) || typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at)) || value.payload_sha256 !== hash(canonical(value.payload)) || canonical(value.limitations) !== canonical(LIMITATIONS)) error('evidence_integrity_mismatch', 409);
    validatePayload(value.payload); return value;
  }
  async function restore(input) {
    const value = validateEnvelope(input), reasons = [];
    selectionDates(value.payload);
    try {
      const actual = await predict(value.payload.prediction.request);
      if (canonical(actual) !== canonical(value.payload.prediction)) reasons.push('prediction_model_changed');
    } catch { reasons.push('prediction_model_unavailable'); }
    if (value.payload.gravity) {
      try { if (!gravity || canonical(await gravity(value.payload.gravity.kind, value.payload.gravity.result.request)) !== canonical(value.payload.gravity.result)) reasons.push('gravity_model_changed'); }
      catch { reasons.push('gravity_model_unavailable'); }
    }
    if (value.payload.source) {
      try {
        const current = await currentRow(value.payload.source), row = current.row;
        if (current.sha256 !== value.payload.source.source_sha256 || !row || row.id !== value.payload.source.preset_id || canonical(normalizeOrbit(row.orbit)) !== canonical(normalizeOrbit(value.payload.orbit))) reasons.push('hypothesis_source_changed');
      } catch { reasons.push('hypothesis_source_unavailable'); }
    }
    if (value.payload.region_context) {
      try { if (!validateRegion || !await validateRegion(value.payload.region_context)) reasons.push('region_context_changed'); }
      catch { reasons.push('region_source_unavailable'); }
    }
    const filename = path.join(directory, value.evidence_id + '.json');
    if (fs.existsSync(filename)) { if (canonical(parse(fs.readFileSync(filename, 'utf8'))) !== canonical(value)) error('evidence_id_collision', 409); }
    else atomic(filename, value);
    return { status: reasons.length ? 'recalculation_required' : 'restored', reasons, evidence: value };
  }
  return { save, raw, restore, validateEnvelope };
}
module.exports = { evidenceStore, VERSION, KIND, LIMITATIONS };

'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const VERSION = 'jpl-tno-factual-description-v1';
const RECORD = 'data/reference/outer-tno/r029-r031-20261115/jpl-tno-identity-bulk.source.json';
const FIELDS = ['spkid', 'kind', 'prefix', 'pdes', 'full_name', 'class'];
const LINKS = Object.freeze([
  { id: 'sbdb_fields', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html' },
  { id: 'orbit_class', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html' },
  { id: 'designation', url: 'https://docs.minorplanetcenter.net/mpc-ops-docs/designations/' }
]);
function fail(code) { return Object.assign(new Error(code), { code }); }
function read(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw fail('tno_info_source_path');
  const base = fs.realpathSync(root), file = fs.realpathSync(path.join(base, relative));
  if (!file.startsWith(base + path.sep)) throw fail('tno_info_source_path');
  return fs.readFileSync(file);
}
function idString(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw fail('tno_info_identity');
  const id = String(value); if (!/^[0-9]+$/.test(id)) throw fail('tno_info_identity'); return id;
}
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value); return Number.isFinite(number) ? number : null;
}
function designationType(identity) {
  if (/^[0-9]+$/.test(identity.pdes)) return 'permanent_number';
  if (identity.prefix === 'A') return 'asteroid_comet_style';
  if (/^[0-9]{4} [A-Z]{2}[0-9]*$/.test(identity.pdes)) return 'provisional_designation';
  return 'catalogue_designation';
}

/** Exact-ID supplementary JPL identity data. No MCP process or remote request is
 * needed on the host. Original orbital/physical rows are never overwritten. */
function createTnoInformation(root, objects, snapshotSha) {
  const source = JSON.parse(read(root, RECORD)), raw = read(root, source.path);
  const sourceUrl = new URL(source.url);
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'ssd-api.jpl.nasa.gov' || sourceUrl.pathname !== '/sbdb_query.api') throw fail('tno_info_source_url');
  if (raw.length !== source.bytes || crypto.createHash('sha256').update(raw).digest('hex') !== source.sha256) throw fail('tno_info_source_integrity');
  const payload = JSON.parse(raw);
  if (payload.signature?.version !== '1.0' || payload.signature?.source !== 'NASA/JPL SBDB (Small-Body DataBase) Query API'
      || JSON.stringify(payload.fields) !== JSON.stringify(FIELDS) || Number(payload.count) !== objects.length
      || !Array.isArray(payload.data) || payload.data.length !== objects.length) throw fail('tno_info_source_schema');
  const identities = new Map();
  for (const values of payload.data) {
    if (!Array.isArray(values) || values.length !== FIELDS.length) throw fail('tno_info_source_schema');
    const identity = Object.fromEntries(FIELDS.map((field, i) => [field, values[i]]));
    const id = idString(identity.spkid);
    if (identities.has(id) || identity.class !== 'TNO' || !['an', 'au', 'cn', 'cu'].includes(identity.kind)
        || typeof identity.pdes !== 'string' || typeof identity.full_name !== 'string'
        || !(identity.prefix === null || typeof identity.prefix === 'string')) throw fail('tno_info_identity');
    identities.set(id, identity);
  }
  for (const object of objects) {
    const identity = identities.get(idString(object.spkid));
    if (!identity || object.object_id !== 'sbdb-' + idString(object.spkid) || identity.pdes !== object.pdes) throw fail('tno_info_snapshot_identity_mismatch');
  }
  const provenance = Object.freeze({
    url: source.url, sha256: source.sha256, bytes: source.bytes, received_at_utc: source.received_at_utc,
    api_version: payload.signature.version, snapshot_manifest_sha256: snapshotSha,
    matching_policy: 'exact_SPK_ID_and_primary_designation_not_fuzzy_keyword_search'
  });
  return function information(object) {
    const identity = identities.get(idString(object.spkid));
    if (!identity || identity.pdes !== object.pdes) throw fail('tno_info_snapshot_identity_mismatch');
    const condition = object.quality?.condition_code ?? null;
    const a = numberOrNull(object.semimajor_axis_au), sigmaA = numberOrNull(object.quality?.one_sigma_elements?.sigma_a);
    const periodDays = numberOrNull(object.source_fields?.per);
    return {
      schema_version: '1.0', algorithm_version: VERSION, object_id: object.object_id,
      record_kind: 'observed_catalogue_small_body', prose_origin: 'source_bound_factual_summary_not_official_encyclopaedic_prose',
      designation: { value: identity.pdes, type: designationType(identity), iau_name: object.iau_name ?? null,
        jpl_kind: identity.kind, prefix: identity.prefix },
      orbit_class: { code: 'TNO', definition: 'semimajor_axis_au_greater_than_30_1', iau_planet_status_inferred: false },
      orbit_facts: { period_days: periodDays, period_julian_years: periodDays === null ? null : periodDays / 365.25,
        elements_epoch_jd_tdb: numberOrNull(object.orbit?.epoch_jd_tdb ?? object.source_fields?.epoch) },
      observations: { first_used: object.quality?.first_observation ?? null, last_used: object.quality?.last_observation ?? null,
        arc_days: numberOrNull(object.quality?.data_arc_days), count: numberOrNull(object.quality?.observations_used),
        condition_code: condition, normalized_rms: numberOrNull(object.quality?.rms), normalized_rms_unit: 'dimensionless',
        dates_are_discovery_dates: false },
      uncertainty: { highly_uncertain_condition: condition === '9', sigma_a_au: sigmaA,
        sigma_a_at_least_nominal_a: a !== null && sigmaA !== null ? sigmaA >= a : null,
        propagated_position_covariance: null, verified_long_term_precision: false },
      reported_in_this_snapshot: { diameter: Number.isFinite(object.physical?.diameter_km),
        mass: Number.isFinite(object.physical?.mass_kg), density: Number.isFinite(object.physical?.density_g_cm3),
        rotation_period: Number.isFinite(object.physical?.rotation_period_h) },
      marker: { kind: 'calculated_navigation_marker', resolved_photo: false, physical_radius: false, measured_brightness: false },
      provenance, references: LINKS
    };
  };
}
module.exports = { createTnoInformation, constants: Object.freeze({ VERSION, RECORD }), designationType, numberOrNull };

'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { constants, finite, validJD, failure } = require('./planet-nine');
const { createTnoInformation } = require('./tno-info');
const MANIFEST = 'data/manifests/outer_tno.json', SOURCE_VERSION = 'jpl-sbdb-tno-two-body-v1', VERSION = 'jpl-sbdb-tno-two-body-v2';
// A display-warning threshold only. It is not an ephemeris validity boundary.
const EXTRAPOLATION_WARNING_DAYS = 36525;
function vector(orbit, jd, eccentric = null) {
  const a = orbit.a_au, e = orbit.e;
  let E = eccentric;
  if (E === null) {
    const mean = ((orbit.M_deg * Math.PI / 180 + Math.sqrt(constants.MU_SUN / a ** 3) * (jd - orbit.epoch_jd_tdb) + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    let low = -Math.PI, high = Math.PI; E = mean;
    for (let i = 0; i < 80; i++) {
      const residual = E - e * Math.sin(E) - mean; if (Math.abs(residual) < 2e-15) break;
      if (residual > 0) high = E; else low = E;
      const next = E - residual / (1 - e * Math.cos(E)); E = next > low && next < high ? next : (low + high) / 2;
    }
    if (Math.abs(E - e * Math.sin(E) - mean) > 1e-12) throw failure('outer_kepler_convergence');
  }
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e ** 2) * Math.sin(E), w = orbit.omega_deg * Math.PI / 180, O = orbit.Omega_deg * Math.PI / 180, I = orbit.i_deg * Math.PI / 180;
  return [(Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * x + (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * y,
    (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * x + (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * y,
    Math.sin(w) * Math.sin(I) * x + Math.cos(w) * Math.sin(I) * y];
}
function safeFile(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => part === '..' || part === '.' || !part)) throw failure('outer_source_path');
  const base = fs.realpathSync(root), absolute = fs.realpathSync(path.join(base, relative));
  if (!absolute.startsWith(base + path.sep)) throw failure('outer_source_path');
  return absolute;
}
function fileRecord(root, source) {
  const raw = fs.readFileSync(safeFile(root, source.local_relative_path));
  if (raw.length !== source.bytes || crypto.createHash('sha256').update(raw).digest('hex') !== source.sha256) throw failure('outer_source_integrity');
  return raw;
}
function orbitValid(o) {
  return o && finite(o.a_au, Number.MIN_VALUE, 1e9) && finite(o.e, 0, 1 - Number.EPSILON) && finite(o.i_deg, 0, 180)
    && ['omega_deg', 'Omega_deg', 'M_deg'].every(key => finite(o[key], -1e9, 1e9)) && finite(o.epoch_jd_tdb, constants.MIN_JD, constants.MAX_JD);
}
function createOuterCatalog(root) {
  const raw = fs.readFileSync(safeFile(root, MANIFEST)), manifest = JSON.parse(raw.toString('utf8'));
  if (manifest.algorithm_version !== SOURCE_VERSION || manifest.schema_version !== '1.0' || manifest.time_scale !== 'TDB'
    || !Array.isArray(manifest.objects) || manifest.objects.length !== manifest.selection.reported_count || !manifest.selection.complete_response) throw failure('outer_source_schema');
  const original = JSON.parse(fileRecord(root, manifest.source)); fileRecord(root, manifest.source.request_metadata);
  if (Number(original.count) !== manifest.objects.length || original.data.length !== manifest.objects.length) throw failure('outer_source_incomplete');
  const ids = new Map(), sourceRows = new Map(original.data.map(row => [String(row[original.fields.indexOf('spkid')]), row]));
  const mapping = { a_au: 'a', e: 'e', i_deg: 'i', omega_deg: 'w', Omega_deg: 'om', M_deg: 'ma', epoch_jd_tdb: 'epoch' };
  for (const object of manifest.objects) {
    if (!/^sbdb-\d+$/.test(object.object_id) || typeof object.spkid !== 'string' || object.object_id !== 'sbdb-' + object.spkid || object.catalog_class !== 'TNO' || ids.has(object.object_id)) throw failure('outer_source_identity');
    const source = sourceRows.get(object.spkid); if (!source) throw failure('outer_source_identity');
    if (object.orbit !== null) {
      if (!orbitValid(object.orbit) || Object.entries(mapping).some(([key, field]) => Number(source[original.fields.indexOf(field)]) !== object.orbit[key])) throw failure('outer_source_elements');
      const calculated = vector(object.orbit, manifest.reference_jd_tdb);
      if (!Array.isArray(object.reference_position_au) || object.reference_position_au.length !== 3
        || Math.hypot(...calculated.map((value, i) => value - object.reference_position_au[i])) > 1e-8 * Math.max(1, Math.hypot(...calculated))) throw failure('outer_source_reference_state');
    }
    ids.set(object.object_id, object);
  }
  const sha = crypto.createHash('sha256').update(raw).digest('hex');
  const information = createTnoInformation(root, manifest.objects, sha);
  const metadata = { schema_version: '1.0', algorithm_version: VERSION, source_algorithm_version: SOURCE_VERSION, source_manifest_sha256: sha, source: manifest.source,
    selection: manifest.selection, coordinate_frame: manifest.coordinate_frame, time_scale: 'TDB', position_unit: 'au', reference_jd_tdb: manifest.reference_jd_tdb,
    reference_epoch_utc_label: manifest.reference_epoch_utc_label, solar_gm_m3_s2: manifest.solar_gm_m3_s2,
    propagation_operating_limit_days: null, extrapolation_warning_after_days: EXTRAPOLATION_WARNING_DAYS,
    supported_calendar: { min_year: -2999, max_year: 3000, min_jd_tdb: constants.MIN_JD, max_jd_tdb: constants.MAX_JD, calendar: 'proleptic_Gregorian_astronomical_year' },
    warning_threshold_definition: 'display_warning_only_not_an_ephemeris_validity_interval',
    default_visible: true, study_radius_au: 1000, force_boundary: false,
    limitations: [...manifest.limitations,
      'The full supported model calendar (-2999 through 3000) is calculated from the same published osculating elements. This is a hypothetical long-range solar Kepler extrapolation, not a historical reconstruction, a future ephemeris, or a verified many-body trajectory.',
      'Beyond100 Julian years from a source epoch the state is explicitly marked unvalidated_kepler_extrapolation. The100-year threshold is a display warning, not a measured validity interval; positions closer to the source epoch are also approximate and do not have a verified propagated uncertainty.',
      'Sources are not frozen at the reference date when the model date changes. Objects beyond1000 AU at the selected date are counted separately from missing elements; their full osculating orbit and selected-object state remain available.'
    ], references: manifest.references };
  function state(object, jd) {
    if (!object.orbit) return { position_au: null, radius_au: null, within_1000_au: null, position_status: 'missing_or_unsupported_elements', long_range_extrapolation: false, epoch_offset_days: null };
    const offset = jd - object.orbit.epoch_jd_tdb, extrapolated = Math.abs(offset) > EXTRAPOLATION_WARNING_DAYS;
    const position = vector(object.orbit, jd), radius = Math.hypot(...position);
    return { position_au: position, radius_au: radius, within_1000_au: radius <= 1000,
      position_status: extrapolated ? 'unvalidated_kepler_extrapolation' : 'osculating_two_body_prediction',
      long_range_extrapolation: extrapolated, epoch_offset_days: offset };
  }
  function catalog() {
    return { ...metadata, objects: manifest.objects.map(o => ({ object_id: o.object_id, spkid: o.spkid, pdes: o.pdes, name: o.name, iau_name: o.iau_name,
      known_object_id: o.known_object_id, orbit: o.orbit, orbit_status: o.orbit_status, semimajor_axis_au: o.semimajor_axis_au,
      perihelion_au: o.perihelion_au, aphelion_au: o.aphelion_au, reference_position_au: o.reference_position_au,
      reference_radius_au: o.reference_radius_au, reference_within_1000_au: o.reference_within_1000_au })) };
  }
  function scene(jd) {
    validJD(jd); let unavailable = 0, outside = 0, extrapolated = 0, extrapolatedPlotted = 0;
    const objects = [];
    for (const object of manifest.objects) {
      const value = state(object, jd);
      if (value.position_au === null) { unavailable++; continue; }
      if (value.long_range_extrapolation) extrapolated++;
      if (!value.within_1000_au) { outside++; continue; }
      if (value.long_range_extrapolation) extrapolatedPlotted++;
      objects.push({ object_id: object.object_id, name: object.name, known_object_id: object.known_object_id, ...value });
    }
    return { ...metadata, jd_tdb: jd, catalogue_count: manifest.objects.length, plotted_count: objects.length,
      unavailable_count: unavailable, outside_1000_au_count: outside, extrapolated_count: extrapolated, extrapolated_plotted_count: extrapolatedPlotted, objects };
  }
  function object(id, jd) {
    validJD(jd); if (typeof id !== 'string' || !ids.has(id)) throw failure('unknown_outer_object');
    const originalObject = ids.get(id), fullOrbit = originalObject.orbit ? Array.from({ length: 257 }, (_, i) => vector(originalObject.orbit, jd, i === 256 ? 0 : 2 * Math.PI * i / 256)) : null;
    return { ...originalObject, info: information(originalObject), algorithm_version: VERSION, source_algorithm_version: SOURCE_VERSION, jd_tdb: jd, ...state(originalObject, jd), full_orbit_au: fullOrbit,
      source_manifest_sha256: sha, source: manifest.source, references: manifest.references, limitations: metadata.limitations,
      orbit_curve_kind: 'instantaneous_osculating_ellipse_not_a_full_period_perturbed_integration', full_orbit_clipped_at_1000_au: false };
  }
  return { catalog, scene, object };
}
module.exports = { createOuterCatalog, position: vector, constants: Object.freeze({ MANIFEST, VERSION, SOURCE_VERSION, EXTRAPOLATION_WARNING_DAYS }) };

'use strict';

// Independent Kepler calculation. The Caltech rows below are synthetic hypotheses,
// not observed objects, and their rounded RA/Dec are not astrometric test oracles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { position, calendarMs } = require('./science');

const DAY_S = 86400, AU_M = 149597870700, C_M_S = 299792458;
const GM_SUN_SI = 1.32712440041279419e20;
const MU_SUN = GM_SUN_SI * DAY_S ** 2 / AU_M ** 3;
const C_AU_DAY = C_M_S * DAY_S / AU_M;
const RAD = Math.PI / 180;
const MIN_JD = calendarMs(-2999) / 86400000 + 2440587.5;
const MAX_JD = calendarMs(3000) / 86400000 + 2440587.5;
const POPULATION_PATH = 'data/raw/legacy_public_originals/planet_nine_reference/reference_population.csv';
const POPULATION_SHA = '050b68182ecbf7fd76f280d8cc43c0683d207499aba1488a68092b834420a422';
const POPULATION_BYTES = 13000682;
const ALGORITHM = 'p9-kepler-sky-v1';
const ORBIT_KEYS = ['a_au', 'e', 'i_deg', 'omega_deg', 'Omega_deg', 'M_deg', 'epoch_jd_tdb', 'mass_earth'];

function failure(code) { const error = new Error(code); error.code = code; error.status = 422; return error; }
function finite(value, low = -Infinity, high = Infinity) { return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high; }
function record(value, keys, code = 'invalid_hypothesis') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw failure(code);
  return value;
}
function wrap(degrees) { return ((degrees % 360) + 360) % 360; }
function validJD(jd) { if (!finite(jd, MIN_JD, MAX_JD)) throw failure('unsupported_hypothesis_date'); return jd; }
function normalizeOrbit(input) {
  record(input, ORBIT_KEYS);
  const mass = input.mass_earth === undefined ? 0 : input.mass_earth;
  if (!finite(input.a_au, .05, 2000) || !finite(input.e, 0, .99) || !finite(input.i_deg, 0, 180)
    || !['omega_deg', 'Omega_deg', 'M_deg'].every(key => finite(input[key], -1e9, 1e9))
    || !finite(mass, 0, 100)) throw failure('invalid_hypothesis');
  return { a_au: input.a_au, e: input.e, i_deg: input.i_deg, omega_deg: wrap(input.omega_deg),
    Omega_deg: wrap(input.Omega_deg), M_deg: wrap(input.M_deg), epoch_jd_tdb: validJD(input.epoch_jd_tdb), mass_earth: mass };
}
function loadPresets(root) {
  const base = fs.realpathSync(root), absolute = fs.realpathSync(path.join(base, POPULATION_PATH));
  if (!absolute.startsWith(base + path.sep)) throw failure('hypothesis_source_unavailable');
  const raw = fs.readFileSync(absolute);
  if (raw.length !== POPULATION_BYTES || crypto.createHash('sha256').update(raw).digest('hex') !== POPULATION_SHA) throw failure('hypothesis_source_integrity');
  const lines = raw.toString('utf8').split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#'));
  const columns = lines[0].split(',').map(value => value.trim());
  const expected = ['index', 'mass', 'a', 'e', 'inc', 'varpi', 'Omega', 'M', 'ra', 'dec', 'R', 'rad', 'albedo', 'V', 'ZTF', 'DES', 'PS1'];
  if (JSON.stringify(columns) !== JSON.stringify(expected)) throw failure('hypothesis_source_schema');
  const presets = lines.slice(1, 4).map((line, row) => {
    const values = line.split(',').map(value => Number(value.trim()));
    if (values.length !== 17 || values.some(value => !Number.isFinite(value)) || values[0] !== row) throw failure('hypothesis_source_schema');
    const source = Object.fromEntries(columns.map((name, i) => [name, values[i]]));
    return { id: 'caltech-row-' + row, row_index: row, kind: 'synthetic_literature_sample',
      orbit: normalizeOrbit({ a_au: source.a, e: source.e, i_deg: source.inc, omega_deg: source.varpi - source.Omega,
        Omega_deg: source.Omega, M_deg: source.M, epoch_jd_tdb: 2458270, mass_earth: source.mass }),
      source_columns: source, reference_ra_deg: source.ra, reference_dec_deg: source.dec,
      reference_heliocentric_distance_au: source.R, argument_derivation: 'omega_deg = (varpi_deg - Omega_deg) modulo 360',
      author_sky_coordinate_reproduction_verified: false };
  });
  return { schema_version: '1.0', algorithm_version: ALGORITHM,
    source: { path: POPULATION_PATH, sha256: POPULATION_SHA, bytes: raw.length, url: 'https://data.caltech.edu/records/8fjad-x7y61',
      epoch_jd_raw: 2458270, epoch_text_raw: '1 June 2018', epoch_calendar_at_numeric_jd: '2018-05-31T12:00:00',
      epoch_discrepancy: true, source_time_scale: 'not_explicitly_verified', adopted_time_scale: 'TDB_project_assumption',
      coordinate_frame: 'J2000 heliocentric osculating elements', source_row_count: 100000, adopted_row_count: 3 },
    presets, limitations: [
      'The population is a synthetic conditional model, not a catalogue of discovered planets or a probability that Planet Nine exists.',
      'The raw numeric JD is preserved. Its calendar conversion is 2018-05-31 noon, whereas the source comment says 1 June 2018; the source time scale is not verified. TDB is an explicit project assumption.',
      'Published elements are rounded. The source RA/Dec observer convention is not independently verified and exact reconstruction of its sky coordinates is not claimed.',
      'The 1000 AU sphere is a displayed study region, not a force cutoff or a physical boundary. A sampled hypothesis may extend outside it.'
    ] };
}
function solveEccentricAnomaly(mean, e) {
  // Bisection is slower than a Newton step but converges for every admitted ellipse,
  // including e=.99 around perihelion, without selecting a spurious root.
  const M = ((mean + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  let low = -Math.PI, high = Math.PI, E = M;
  for (let i = 0; i < 64; i++) {
    const residual = E - e * Math.sin(E) - M;
    if (Math.abs(residual) < 2e-15) return E;
    if (residual > 0) high = E; else low = E;
    const candidate = E - residual / (1 - e * Math.cos(E));
    E = candidate > low && candidate < high ? candidate : (low + high) / 2;
  }
  if (Math.abs(E - e * Math.sin(E) - M) > 1e-12) throw failure('kepler_did_not_converge');
  return E;
}
function rotation(orbit, x, y) {
  const w = orbit.omega_deg * RAD, O = orbit.Omega_deg * RAD, I = orbit.i_deg * RAD;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [(cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
    (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y, sw * sI * x + cw * sI * y];
}
function propagate(input, jd) {
  const orbit = normalizeOrbit(input); validJD(jd);
  const n = Math.sqrt(MU_SUN / orbit.a_au ** 3), M = orbit.M_deg * RAD + n * (jd - orbit.epoch_jd_tdb), E = solveEccentricAnomaly(M, orbit.e);
  const root = Math.sqrt(1 - orbit.e ** 2), dE = n / (1 - orbit.e * Math.cos(E));
  return { jd_tdb: jd, position_au: rotation(orbit, orbit.a_au * (Math.cos(E) - orbit.e), orbit.a_au * root * Math.sin(E)),
    velocity_au_day: rotation(orbit, -orbit.a_au * Math.sin(E) * dE, orbit.a_au * root * Math.cos(E) * dE),
    period_days: 2 * Math.PI / n, eccentric_anomaly_rad: E };
}
function modelTable(model, jd) {
  if (!model?.tables?.long?.bodies || model.time_scale !== 'TDB') throw failure('solar_model_unavailable');
  // Select the explicitly identified better short fit only inside its validity.
  const start = calendarMs(1800) / 86400000 + 2440587.5, end = calendarMs(2050) / 86400000 + 2440587.5;
  return jd >= start && jd <= end && model.tables.short?.bodies ? 'short' : 'long';
}
function solarStates(model, jd) {
  validJD(jd); const table = modelTable(model, jd);
  const states = model.tables[table].bodies.map(body => ({ object_id: body.object_id, position_au: position(body, jd) }));
  if (states.length !== 8 || new Set(states.map(body => body.object_id)).size !== 8) throw failure('solar_model_unavailable');
  return { table, states };
}
function equatorial(vector) {
  const epsilon = 84381.448 / 3600 * RAD;
  const [x, y, z] = vector, yr = Math.cos(epsilon) * y - Math.sin(epsilon) * z, zr = Math.sin(epsilon) * y + Math.cos(epsilon) * z;
  const distance = Math.hypot(x, yr, zr);
  if (!(distance > 1e-12)) throw failure('observer_target_coincident');
  return { ra_deg: wrap(Math.atan2(yr, x) / RAD), dec_deg: Math.asin(Math.max(-1, Math.min(1, zr / distance))) / RAD, distance_au: distance };
}
function skyPath(input, model) {
  record(input, ['orbit', 'start_jd_tdb', 'end_jd_tdb', 'samples', 'observer']);
  const orbit = normalizeOrbit(input.orbit), start = validJD(input.start_jd_tdb), end = validJD(input.end_jd_tdb);
  const samples = input.samples === undefined ? 64 : input.samples, observer = input.observer === undefined ? 'earth_moon_barycenter' : input.observer;
  if (end < start || end - start > 36525 || !Number.isSafeInteger(samples) || samples < 2 || samples > 256
    || !['earth_moon_barycenter', 'sun'].includes(observer)) throw failure('invalid_hypothesis');
  const request = { orbit, start_jd_tdb: start, end_jd_tdb: end, samples, observer };
  const curve = [];
  for (let index = 0; index < samples; index++) {
    const jd = index === samples - 1 ? end : start + (end - start) * index / (samples - 1);
    const solar = observer === 'sun' ? null : solarStates(model, jd), emb = solar?.states.find(body => body.object_id === 'earth');
    if (solar && !emb) throw failure('solar_model_unavailable');
    const observerPosition = emb?.position_au ?? [0, 0, 0], geometric = propagate(orbit, jd);
    let lighttime = 0, emission, converged = false, iterations = 0;
    for (; iterations < 12; iterations++) {
      emission = propagate(orbit, validJD(jd - lighttime));
      const vector = emission.position_au.map((value, axis) => value - observerPosition[axis]);
      const next = Math.hypot(...vector) / C_AU_DAY;
      if (Math.abs(next - lighttime) < 1e-10) { lighttime = next; converged = true; break; }
      lighttime = next;
    }
    if (!converged) throw failure('lighttime_did_not_converge');
    emission = propagate(orbit, jd - lighttime);
    const sky = equatorial(emission.position_au.map((value, axis) => value - observerPosition[axis]));
    curve.push({ jd_tdb: jd, ...sky, position_au: geometric.position_au, velocity_au_day: geometric.velocity_au_day,
      emission_jd_tdb: jd - lighttime, emission_position_au: emission.position_au, observer_position_au: observerPosition,
      lighttime_days: lighttime, lighttime_iterations: iterations + 1, within_1000_au: Math.hypot(...geometric.position_au) <= 1000,
      observer_model_table: solar?.table ?? null });
  }
  const fullOrbit = Array.from({ length: 257 }, (_, i) => {
    const E = i === 256 ? 0 : 2 * Math.PI * i / 256;
    return rotation(orbit, orbit.a_au * (Math.cos(E) - orbit.e), orbit.a_au * Math.sqrt(1 - orbit.e ** 2) * Math.sin(E));
  });
  return { schema_version: '1.0', algorithm_version: ALGORITHM, status: 'conditional_hypothesis', request, orbit,
    period_days: 2 * Math.PI * Math.sqrt(orbit.a_au ** 3 / MU_SUN), path: curve, full_orbit_au: fullOrbit,
    coordinate_frame: 'mean_equatorial_J2000_IAU1976_rotation_approximation', position_frame: 'mean_ecliptic_J2000_heliocentric',
    observer, observer_identity: observer === 'sun' ? 'fixed_model_sun' : 'JPL_fitted_Earth_Moon_barycenter_not_Earth_center_or_SPHEREx',
    observer_model_manifest_sha256: observer === 'sun' ? null : model.source_manifest_sha256,
    assumptions: { time_scale: 'TDB', source_epoch_time_scale: 'project_assumption_when_using_Caltech_presets',
      force_model: 'Newtonian_solar_point_mass_massless_test_particle', hypothetical_mass_used_in_own_orbit: false,
      lighttime: 'iterative_fixed_solar_origin', lighttime_tolerance_days: 1e-10, lighttime_max_iterations: 12,
      solar_barycentric_motion_during_lighttime: 'omitted', aberration: 'omitted', light_deflection: 'omitted',
      frame_bias_to_ICRS: 'not_applied', source_element_covariance: 'unavailable', measured_motion: false, discovery_claim: false },
    constants: { solar_gm_m3_s2: GM_SUN_SI, au_m: AU_M, c_m_s: C_M_S, source_url: 'https://ssd.jpl.nasa.gov/astro_par.html' },
    limitations: [
      'An individual synthetic or user hypothesis, not a discovered object, existence probability, orbit fit, or reconstruction of a measured image motion.',
      'Kepler propagation uses solar point-mass gravity only. The entered mass does not change this test-particle trajectory; it may be used as an optional source in a separate gravity calculation.',
      'Sky coordinates use a declared J2000 rotation and iterative light time in a fixed heliocentric origin. No precise ICRS realization, aberration, gravitational light deflection, or solar barycentric correction is claimed.',
      'The observer is the fitted Earth-Moon barycenter (unless Sun is selected), not the terrestrial geocenter, SPHEREx, or the freely moving screen camera.',
      'Fit errors, rounded source elements, unknown source time convention and missing covariance are not represented by the light-time numerical tolerance.',
      '1000 AU is a study-region marker, not a dynamical force boundary; points outside it remain calculated and flagged.'
    ] };
}

module.exports = { loadPresets, normalizeOrbit, propagate, skyPath, solarStates, equatorial, failure, record, finite, validJD,
  constants: Object.freeze({ DAY_S, AU_M, C_M_S, C_AU_DAY, GM_SUN_SI, MU_SUN, MIN_JD, MAX_JD, POPULATION_PATH, POPULATION_SHA, POPULATION_BYTES, ALGORITHM }) };

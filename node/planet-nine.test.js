'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { loadPresets, normalizeOrbit, propagate, skyPath, equatorial, constants } = require('./planet-nine');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const model = read('data/node-runtime/snapshots/long_term_model.json');
const circular = { a_au: 100, e: 0, i_deg: 0, omega_deg: 0, Omega_deg: 0, M_deg: 0, epoch_jd_tdb: 2451545, mass_earth: 5 };
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

test('source rows retain raw values, derive argument from varpi, and disclose epoch discrepancy', () => {
  const rows = loadPresets(root);
  assert.equal(rows.source.sha256, constants.POPULATION_SHA);
  assert.equal(rows.source.epoch_jd_raw, 2458270);
  assert.equal(rows.source.epoch_calendar_at_numeric_jd, '2018-05-31T12:00:00');
  assert.equal(rows.source.epoch_discrepancy, true);
  assert.equal(rows.presets.length, 3);
  const expectedOmega = [204.82, 126.30, 141.95];
  for (const [i, row] of rows.presets.entries()) {
    assert.ok(Math.abs(row.orbit.omega_deg - expectedOmega[i]) < 1e-12);
    assert.equal(Object.keys(row.source_columns).length, 17);
    assert.equal(row.author_sky_coordinate_reproduction_verified, false);
  }
  assert.ok(rows.presets[2].reference_heliocentric_distance_au > 1000);
});

test('circular orbit quarters, Kepler third law and massless convention are analytic', () => {
  const state = propagate(circular, circular.epoch_jd_tdb);
  assert.ok(distance(state.position_au, [100, 0, 0]) < 1e-12);
  const quarter = propagate(circular, circular.epoch_jd_tdb + state.period_days / 4);
  assert.ok(distance(quarter.position_au, [0, 100, 0]) < 1e-10);
  const large = propagate({ ...circular, a_au: 400 }, circular.epoch_jd_tdb);
  assert.ok(Math.abs(large.period_days / state.period_days - 8) < 1e-13);
  const earthYear = propagate({ ...circular, a_au: 1 }, circular.epoch_jd_tdb).period_days;
  assert.ok(Math.abs(earthYear - 365.256898) < 1e-5);
  assert.deepEqual(propagate({ ...circular, mass_earth: 100 }, circular.epoch_jd_tdb), state);
});

test('eccentric perihelion/aphelion and vis-viva independently constrain state and velocity', () => {
  const orbit = { ...circular, a_au: 50, e: .8, i_deg: 47, omega_deg: 26, Omega_deg: 81 };
  const peri = propagate(orbit, orbit.epoch_jd_tdb), apo = propagate(orbit, orbit.epoch_jd_tdb + peri.period_days / 2);
  for (const [state, radius] of [[peri, 10], [apo, 90]]) {
    assert.ok(Math.abs(Math.hypot(...state.position_au) - radius) < 1e-10);
    const speed2 = state.velocity_au_day.reduce((sum, value) => sum + value * value, 0);
    assert.ok(Math.abs(speed2 / (constants.MU_SUN * (2 / radius - 1 / orbit.a_au)) - 1) < 2e-12);
  }
  const polar = propagate({ ...circular, i_deg: 90, M_deg: 90 }, circular.epoch_jd_tdb);
  assert.ok(distance(polar.position_au, [0, 0, 100]) < 1e-10);
});

test('source Horizons elements reconstruct independently queried Pluto geometric positions at matching events', () => {
  const elements = read('data/manifests/solar_system_orbits.json').bodies.find(body => body.object_id === 'pluto');
  const vectors = read('data/manifests/solar_system_ephemeris.json').bodies.find(body => body.object_id === 'pluto');
  for (const sample of elements.samples) {
    const e = sample.elements, orbit = { a_au: e.a_au, e: e.e, i_deg: e.inclination_deg,
      omega_deg: e.argument_periapsis_deg, Omega_deg: e.node_deg, M_deg: e.mean_anomaly_deg, epoch_jd_tdb: sample.epoch_jd_tdb, mass_earth: 0 };
    const original = vectors.samples.find(row => row.epoch_utc === sample.epoch_utc);
    assert.ok(distance(propagate(orbit, sample.epoch_jd_tdb).position_au, original.position_au) < 1e-10);
  }
  // A same-model element/vector consistency check, not independent physical accuracy,
  // SPHEREx observer astrometry, or a future two-body Pluto orbit validation.
});

test('sky output carries normalized request and converged light time without claiming SPHEREx or exact ICRS', () => {
  const orbit = { ...circular, a_au: 1000, M_deg: -360 };
  const value = skyPath({ orbit, start_jd_tdb: 2461358.5, end_jd_tdb: 2461361.5, samples: 4 }, model);
  assert.equal(value.request.orbit.M_deg, 0);
  assert.equal(value.observer, 'earth_moon_barycenter');
  assert.equal(value.path.length, 4);
  assert.equal(value.full_orbit_au.length, 257);
  assert.deepEqual(value.full_orbit_au[0], value.full_orbit_au[256]);
  assert.equal(value.assumptions.frame_bias_to_ICRS, 'not_applied');
  for (const row of value.path) {
    assert.ok(row.ra_deg >= 0 && row.ra_deg < 360 && Math.abs(row.dec_deg) <= 90);
    assert.ok(row.lighttime_iterations <= 12 && row.lighttime_days > 5.7 && row.lighttime_days < 5.9);
    assert.ok(Math.abs(row.distance_au / constants.C_AU_DAY - row.lighttime_days) < 1e-10);
  }
  const fromSun = skyPath({ orbit, start_jd_tdb: orbit.epoch_jd_tdb, end_jd_tdb: orbit.epoch_jd_tdb, samples: 2, observer: 'sun' });
  assert.equal(fromSun.observer_model_manifest_sha256, null);
  assert.ok(fromSun.path[0].ra_deg > 359.99); // moving target at emission time lies behind the +x axis
  assert.equal(equatorial([0, 0, 1]).dec_deg, 90 - 84381.448 / 3600);
});

test('invalid, nonfinite, unknown and oversized inputs fail closed', () => {
  for (const values of [{ e: 1 }, { a_au: 0 }, { i_deg: 181 }, { M_deg: Infinity }, { mass_earth: -1 }, { mass_earth: null }, { epoch_jd_tdb: NaN }, { unknown: 1 }]) {
    assert.throws(() => normalizeOrbit({ ...circular, ...values }));
  }
  for (const values of [{ samples: 257 }, { samples: 1 }, { samples: 2.5 }, { samples: null }, { observer: null }, { observer: 'spherex' }, { end_jd_tdb: 2451000 }, { start_jd_tdb: null }]) {
    assert.throws(() => skyPath({ orbit: circular, start_jd_tdb: 2451545, end_jd_tdb: 2451546, ...values }, model));
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gravityField, integrateParticle, solar1PN, constants: g } = require('./solar-gravity');
const { constants: k, propagate } = require('./planet-nine');
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/node-runtime/snapshots/long_term_model.json'), 'utf8'));
const orbit = { a_au: 45, e: .1, i_deg: 8, omega_deg: 30, Omega_deg: 80, M_deg: 25, epoch_jd_tdb: 2461358.5, mass_earth: 5 };
const separation = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('solar force has correct direction, SI value and inverse-square scaling beyond 1000 AU', () => {
  const a = gravityField({ position_au: [1, 0, 0], jd_tdb: 2461358.5, include_planets: false }, model);
  assert.ok(a.direct_acceleration_au_day2[0] < 0);
  assert.equal(a.direct_acceleration_au_day2[1], 0);
  assert.ok(Math.abs(a.direct_magnitude_m_s2 - k.GM_SUN_SI / k.AU_M ** 2) < 1e-16);
  const b = gravityField({ position_au: [2, 0, 0], jd_tdb: 2461358.5, include_planets: false }, model);
  assert.ok(Math.abs(a.direct_magnitude_m_s2 / b.direct_magnitude_m_s2 - 4) < 1e-14);
  const outside = gravityField({ position_au: [1001, 0, 0], jd_tdb: 2461358.5, include_planets: false }, model);
  assert.equal(outside.within_1000_au, false);
  assert.ok(outside.direct_magnitude_m_s2 > 0);
});

test('planet contributions use system masses and heliocentric indirect terms', () => {
  const value = gravityField({ position_au: [700, 5, 0], jd_tdb: 2461358.5 }, model);
  assert.equal(value.components.length, 9);
  const earth = value.components.find(row => row.object_id === 'earth');
  assert.equal(g.GM.earth, 398600.435507 + 4902.800118);
  const sourceR = Math.hypot(...earth.source_position_au);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(earth.indirect_acceleration_au_day2[i] + earth.gm_au3_day2 * earth.source_position_au[i] / sourceR ** 3) < 1e-22);
    const total = value.components.reduce((sum, row) => sum + row.heliocentric_acceleration_au_day2[i], 0);
    assert.ok(Math.abs(value.heliocentric_acceleration_au_day2[i] - total) < 1e-20);
  }
  assert.equal(value.interpretation.boundary, 'display_only_no_force_cutoff');
});

test('hypothetical source mass controls field linearly and does not invent self-force', () => {
  const input = { position_au: [700, 20, 10], jd_tdb: 2461358.5, include_planets: false };
  const a = gravityField({ ...input, hypothesis: { ...orbit, a_au: 500, mass_earth: 5 } }, model);
  const b = gravityField({ ...input, hypothesis: { ...orbit, a_au: 500, mass_earth: 10 } }, model);
  const ca = a.components.find(row => row.object_id === 'hypothetical_planet_nine'), cb = b.components.find(row => row.object_id === 'hypothetical_planet_nine');
  assert.ok(Math.abs(cb.direct_magnitude_m_s2 / ca.direct_magnitude_m_s2 - 2) < 1e-14);
  const state = propagate(orbit, input.jd_tdb);
  assert.throws(() => gravityField({ ...input, position_au: state.position_au, hypothesis: orbit }, model), /close_encounter/);
});

test('optional solar 1PN satisfies independent stationary/circular/radial limits', () => {
  const r = [50, 0, 0], mu = k.MU_SUN, c2 = k.C_AU_DAY ** 2;
  const stationary = solar1PN(r, [0, 0, 0]);
  assert.ok(Math.abs(stationary[0] / (4 * mu ** 2 / (c2 * 50 ** 3)) - 1) < 1e-14);
  const speed = Math.sqrt(mu / 50), circular = solar1PN(r, [0, speed, 0]);
  assert.ok(Math.abs(circular[0] / (3 * mu ** 2 / (c2 * 50 ** 3)) - 1) < 1e-14);
  assert.equal(circular[1], 0);
  const radial = solar1PN(r, [speed, 0, 0]);
  assert.ok(Math.abs(radial[0] / (7 * mu ** 2 / (c2 * 50 ** 3)) - 1) < 1e-14);
  assert.throws(() => gravityField({ position_au: r, jd_tdb: 2461358.5, include_solar_gr_1pn: true }, model), /velocity_required/);
});

test('solar-only RK4 converges toward the analytic Kepler solution and conserves energy/angular momentum', async () => {
  const input = { orbit, start_jd_tdb: orbit.epoch_jd_tdb, duration_days: 1000, step_days: 4, include_planets: false };
  const value = await integrateParticle(input, model);
  assert.ok(value.convergence.pure_kepler_endpoint_error_au < 1e-8);
  assert.ok(Math.abs(value.energy.relative_change) < 1e-10);
  assert.ok(value.energy.solar_specific_angular_momentum_relative_change < 1e-10);
  assert.equal(value.energy.expected_conserved_in_this_run, true);
  assert.equal(value.integrator.accepted_steps, value.integrator.coarse_steps * 2);
  const circular = { ...orbit, a_au: 35, e: 0, i_deg: 0, omega_deg: 0, Omega_deg: 0, M_deg: 0 };
  const coarse = await integrateParticle({ ...input, orbit: circular, duration_days: 8000, step_days: 4 }, model);
  const fine = await integrateParticle({ ...input, orbit: circular, duration_days: 8000, step_days: 2 }, model, { max_elapsed_ms: 10000 });
  // Outer-orbit RK4 truncation errors can be below roundoff at these small steps.
  assert.ok(fine.convergence.pure_kepler_endpoint_error_au <= coarse.convergence.pure_kepler_endpoint_error_au + 1e-10);
});

test('prescribed planets and optional 1PN alter the path while retaining force-model limits', async () => {
  const request = { orbit, start_jd_tdb: orbit.epoch_jd_tdb, duration_days: 200, step_days: 2 };
  const withPlanets = await integrateParticle(request, model);
  const pure = await integrateParticle({ ...request, include_planets: false }, model);
  assert.ok(separation(withPlanets.final_state.position_au, pure.final_state.position_au) > 1e-6);
  assert.equal(withPlanets.energy.expected_conserved_in_this_run, false);
  assert.equal(withPlanets.force_model.prescribed_planetary_systems.length, 8);
  assert.equal(withPlanets.force_model.backreaction, false);
  const gr = await integrateParticle({ ...request, include_planets: false, include_solar_gr_1pn: true }, model);
  assert.ok(separation(gr.final_state.position_au, pure.final_state.position_au) > 1e-14);
  assert.equal(gr.force_model.solar_gr_1pn, true);
});

test('bounded integration yields to the event loop and honors cancellation and input limits', async () => {
  let turn = false; setImmediate(() => { turn = true; });
  const pending = integrateParticle({ orbit, start_jd_tdb: orbit.epoch_jd_tdb, duration_days: 100, step_days: 1 }, model, { shouldCancel: () => turn });
  await assert.rejects(pending, /gravity_cancelled/);
  for (const changed of [{ step_days: 0 }, { step_days: null }, { duration_days: null }, { duration_days: 14611 }, { duration_days: 1000, step_days: .05 }, { orbit: { ...orbit, e: .99 } }, { include_planets: 'true' }]) {
    await assert.rejects(integrateParticle({ orbit, start_jd_tdb: orbit.epoch_jd_tdb, duration_days: 100, step_days: 1, ...changed }, model));
  }
  assert.throws(() => gravityField({ position_au: [0, 0, 0], jd_tdb: 2461358.5 }, model));
});

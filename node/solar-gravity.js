'use strict';

// Restricted, prescribed-planet force model, not an ephemeris-quality N-body fit.
// Constants: JPL SSD DE440 table, https://ssd.jpl.nasa.gov/astro_par.html .
// The optional solar 1PN test-particle equation is Eq. (1), Holman et al.,
// ASSIST: An Ephemeris-quality Test-particle Integrator, PSJ 4:69 (2023),
// https://doi.org/10.3847/PSJ/acc9a9 . This is an independent formula implementation.
const { normalizeOrbit, propagate, solarStates, constants, failure, record, finite, validJD } = require('./planet-nine');
const { DAY_S, AU_M, C_AU_DAY, MU_SUN } = constants;
const GM_SCALE = 1e9 * DAY_S ** 2 / AU_M ** 3;
const ACCEL_SI = AU_M / DAY_S ** 2;
const GM = Object.freeze({ mercury: 22031.868551, venus: 324858.592000, earth: 398600.435507 + 4902.800118,
  mars: 42828.375816, jupiter: 126712764.100000, saturn: 37940584.841800, uranus: 5794556.400000, neptune: 6836527.100580 });
const EARTH_GM = 398600.435507 * GM_SCALE;
const ALGORITHM = 'solar-prescribed-planets-rk4-v1';
const OMISSIONS = Object.freeze([
  'Planetary positions are prescribed JPL fitted-element approximations. Their mutual gravity is not numerically reintegrated and they do not react to the test particle or optional hypothetical perturber.',
  'The Earth entry combines Earth and Moon GM at the Earth-Moon barycenter. Other entries use the listed planetary-system GM; individual moons are not separate force sources.',
  'Dwarf planets, asteroids, comet outgassing, ring gravity, tides, J2 and higher multipoles, radiation pressure, solar wind, Galactic tides, passing stars, and dark matter are omitted.',
  'The optional solar 1PN correction is the nonrotating, central-mass, weak-field test-particle approximation. Full relativistic N-body dynamics, solar spin, quantum, electromagnetic and fluid calculations are not implemented.',
  'This is a conditional short integration with no covariance model or long-term stability claim, not a fitted physical reproduction of all material inside 1000 AU.',
  'The 1000 AU study sphere does not truncate forces or trajectories. No unobserved bodies are automatically invented.'
]);
function vector(value, code = 'invalid_gravity_input') {
  if (!Array.isArray(value) || value.length !== 3 || value.some(x => !finite(x, -5000, 5000))) throw failure(code);
  return value;
}
function add(a, b) { return a.map((x, i) => x + b[i]); }
function mul(a, b) { return a.map(x => x * b); }
function sub(a, b) { return a.map((x, i) => x - b[i]); }
function dot(a, b) { return a.reduce((sum, x, i) => sum + x * b[i], 0); }
function norm(a) { return Math.hypot(...a); }
function solar1PN(r, v) {
  vector(r); vector(v);
  const radius = norm(r);
  if (radius < .005 || norm(v) > .01 * C_AU_DAY) throw failure('outside_weak_field_model');
  const factor = MU_SUN / (C_AU_DAY ** 2 * radius ** 3), radial = 4 * MU_SUN / radius - dot(v, v), mixed = 4 * dot(r, v);
  return r.map((x, i) => factor * (radial * x + mixed * v[i]));
}
function boolean(value, fallback) { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw failure('invalid_gravity_input'); return value; }
function component(id, sourcePosition, mu, r, minimumDistance = 1e-3) {
  const delta = sub(sourcePosition, r), distance = norm(delta), sourceDistance = norm(sourcePosition);
  if (distance < minimumDistance) throw failure('gravity_close_encounter_unsupported');
  const direct = mul(delta, mu / distance ** 3), indirect = sourceDistance > 0 ? mul(sourcePosition, -mu / sourceDistance ** 3) : [0, 0, 0];
  return { object_id: id, source_position_au: sourcePosition, distance_au: distance, gm_au3_day2: mu,
    direct_acceleration_au_day2: direct, indirect_acceleration_au_day2: indirect,
    heliocentric_acceleration_au_day2: add(direct, indirect), direct_magnitude_m_s2: norm(direct) * ACCEL_SI };
}
function fieldInternal(r, jd, model, options) {
  const radius = norm(r);
  if (radius < .005 || radius > 5000) throw failure('outside_gravity_domain');
  const components = [component('sun', [0, 0, 0], MU_SUN, r, .005)];
  const solar = options.include_planets ? solarStates(model, jd) : null;
  if (solar) for (const body of solar.states) {
    if (!GM[body.object_id]) throw failure('solar_model_unavailable');
    components.push(component(body.object_id, body.position_au, GM[body.object_id] * GM_SCALE, r));
  }
  if (options.hypothesis && options.hypothesis.mass_earth > 0) {
    const state = propagate(options.hypothesis, jd);
    components.push(component('hypothetical_planet_nine', state.position_au, options.hypothesis.mass_earth * EARTH_GM, r));
  }
  const direct = components.reduce((sum, row) => add(sum, row.direct_acceleration_au_day2), [0, 0, 0]);
  const indirect = components.reduce((sum, row) => add(sum, row.indirect_acceleration_au_day2), [0, 0, 0]);
  const gr = options.include_solar_gr_1pn ? solar1PN(r, options.velocity_au_day) : [0, 0, 0];
  return { components, direct, indirect, gr, total: add(add(direct, indirect), gr), table: solar?.table ?? null };
}
function gravityField(input, model) {
  record(input, ['position_au', 'jd_tdb', 'hypothesis', 'include_planets', 'velocity_au_day', 'include_solar_gr_1pn'], 'invalid_gravity_input');
  const r = vector(input.position_au), jd = validJD(input.jd_tdb), includePlanets = boolean(input.include_planets, true), includeGR = boolean(input.include_solar_gr_1pn, false);
  const hypothesis = input.hypothesis === undefined ? null : normalizeOrbit(input.hypothesis);
  const velocity = input.velocity_au_day === undefined ? null : vector(input.velocity_au_day);
  if (includeGR && velocity === null) throw failure('gravity_velocity_required_for_1pn');
  const value = fieldInternal(r, jd, model, { include_planets: includePlanets, include_solar_gr_1pn: includeGR, hypothesis, velocity_au_day: velocity });
  return { schema_version: '1.0', algorithm_version: ALGORITHM, status: 'conditional_gravity_model',
    request: { position_au: [...r], jd_tdb: jd, include_planets: includePlanets, include_solar_gr_1pn: includeGR,
      ...(hypothesis ? { hypothesis } : {}), ...(velocity ? { velocity_au_day: [...velocity] } : {}) },
    position_au: [...r], jd_tdb: jd, radius_au: norm(r), within_1000_au: norm(r) <= 1000,
    coordinate_frame: 'heliocentric_mean_ecliptic_J2000', components: value.components,
    direct_acceleration_au_day2: value.direct, indirect_acceleration_au_day2: value.indirect,
    solar_1pn_acceleration_au_day2: value.gr, heliocentric_acceleration_au_day2: value.total,
    direct_magnitude_m_s2: norm(value.direct) * ACCEL_SI, heliocentric_magnitude_m_s2: norm(value.total) * ACCEL_SI,
    interpretation: { direct: 'physical_Newtonian_field_at_position_in_inertial_axes',
      indirect: 'negative_acceleration_of_solar_origin_from_prescribed_external_sources',
      heliocentric: 'direct_plus_indirect_plus_optional_solar_1PN_for_relative_trajectory',
      mass_unit: 'Earth_mass_uses_Earth_body_GM_not_EMB_GM', source_positions: 'prescribed_approximate_positions', boundary: 'display_only_no_force_cutoff' },
    model_table: value.table, source_manifest_sha256: model?.source_manifest_sha256 ?? null,
    constants: { gm_source_url: 'https://ssd.jpl.nasa.gov/astro_par.html', gm_table: 'DE440', gm_km3_s2: GM,
      sun_gm_m3_s2: constants.GM_SUN_SI, au_m: AU_M, c_m_s: constants.C_M_S }, limitations: [...OMISSIONS] };
}
function centralEnergy(state) { return dot(state.velocity_au_day, state.velocity_au_day) / 2 - MU_SUN / norm(state.position_au); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
async function integrateParticle(input, model, hooks = {}) {
  record(input, ['orbit', 'start_jd_tdb', 'duration_days', 'step_days', 'include_planets', 'include_solar_gr_1pn', 'hypothesis'], 'invalid_gravity_input');
  const orbit = normalizeOrbit(input.orbit), start = validJD(input.start_jd_tdb), duration = input.duration_days === undefined ? 3652.5 : input.duration_days, desiredStep = input.step_days === undefined ? 1 : input.step_days;
  const includePlanets = boolean(input.include_planets, true), includeGR = boolean(input.include_solar_gr_1pn, false);
  const hypothesis = input.hypothesis === undefined ? null : normalizeOrbit(input.hypothesis);
  if (!finite(duration, -14610, 14610) || duration === 0 || !finite(desiredStep, .05, 4)) throw failure('invalid_gravity_input');
  const steps = Math.ceil(Math.abs(duration) / desiredStep);
  if (steps > 4096) throw failure('gravity_step_limit');
  validJD(start + duration);
  if (orbit.a_au * (1 - orbit.e) < 35) throw failure('gravity_requires_outer_orbit_perihelion_35au');
  const initial = propagate(orbit, start), requested = { orbit, start_jd_tdb: start, duration_days: duration, step_days: desiredStep,
    include_planets: includePlanets, include_solar_gr_1pn: includeGR, ...(hypothesis ? { hypothesis } : {}) };
  const began = performance.now(), budgetMs = finite(hooks.max_elapsed_ms, 1, 10000) ? hooks.max_elapsed_ms : 2500;
  const control = () => { if (hooks.shouldCancel?.()) throw failure('gravity_cancelled'); if (performance.now() - began > budgetMs) throw failure('gravity_time_limit'); };
  function derivative(jd, state) {
    const r = state.slice(0, 3), v = state.slice(3);
    if (norm(r) < 34 || norm(r) > 5000 || norm(v) > .01 * C_AU_DAY) throw failure('gravity_integration_domain');
    const field = fieldInternal(r, jd, model, { include_planets: includePlanets, include_solar_gr_1pn: includeGR, hypothesis, velocity_au_day: v });
    return [...v, ...field.total];
  }
  async function run(count, save) {
    let y = [...initial.position_au, ...initial.velocity_au_day]; const dt = duration / count;
    const output = [], stride = Math.max(1, Math.ceil(count / 512));
    let energyMin = centralEnergy(initial), energyMax = energyMin;
    for (let step = 0; step <= count; step++) {
      if (step % 32 === 0) { control(); await new Promise(resolve => setImmediate(resolve)); }
      const jd = step === count ? start + duration : start + step * dt;
      const energy = centralEnergy({ position_au: y.slice(0, 3), velocity_au_day: y.slice(3) });
      energyMin = Math.min(energyMin, energy); energyMax = Math.max(energyMax, energy);
      if (save && (step % stride === 0 || step === count)) output.push({ jd_tdb: jd, position_au: y.slice(0, 3), velocity_au_day: y.slice(3),
        radius_au: norm(y.slice(0, 3)), within_1000_au: norm(y.slice(0, 3)) <= 1000, solar_specific_energy_au2_day2: energy });
      if (step === count) break;
      const k1 = derivative(jd, y), k2 = derivative(jd + dt / 2, add(y, mul(k1, dt / 2))),
        k3 = derivative(jd + dt / 2, add(y, mul(k2, dt / 2))), k4 = derivative(jd + dt, add(y, mul(k3, dt)));
      y = y.map((value, axis) => value + dt / 6 * (k1[axis] + 2 * k2[axis] + 2 * k3[axis] + k4[axis]));
      if (y.some(value => !Number.isFinite(value))) throw failure('gravity_integration_nonfinite');
    }
    return { end: y, path: output, energyMin, energyMax };
  }
  const coarse = await run(steps, false), fine = await run(steps * 2, true);
  control();
  const startEnergy = centralEnergy(initial), finalState = { position_au: fine.end.slice(0, 3), velocity_au_day: fine.end.slice(3) }, endEnergy = centralEnergy(finalState);
  const positionDifference = norm(sub(coarse.end.slice(0, 3), fine.end.slice(0, 3))), velocityDifference = norm(sub(coarse.end.slice(3), fine.end.slice(3)));
  const h0 = cross(initial.position_au, initial.velocity_au_day), h1 = cross(finalState.position_au, finalState.velocity_au_day);
  const pureKepler = !includePlanets && !includeGR && !hypothesis, expected = pureKepler ? propagate(orbit, start + duration) : null;
  return { schema_version: '1.0', algorithm_version: ALGORITHM, status: 'conditional_trajectory', request: requested,
    coordinate_frame: 'heliocentric_mean_ecliptic_J2000', time_scale: 'TDB', position_unit: 'au', velocity_unit: 'au/day',
    path: fine.path, initial_state: initial, final_state: finalState,
    force_model: { sun_newtonian: true, prescribed_planetary_systems: includePlanets ? Object.keys(GM) : [], solar_gr_1pn: includeGR,
      hypothetical_perturber: hypothesis, massless_integrated_particle: true, body_mass_used_in_own_motion: false, backreaction: false,
      heliocentric_indirect_terms: includePlanets || hypothesis !== null, cutoff_at_1000_au: false },
    integrator: { name: 'classical_Runge_Kutta_4', requested_step_days: desiredStep, coarse_step_days: duration / steps,
      accepted_step_days: duration / (steps * 2), coarse_steps: steps, accepted_steps: steps * 2, output_points: fine.path.length,
      maximum_coarse_steps: 4096, domain_perihelion_min_au: 35, step_halving: true },
    convergence: { endpoint_position_difference_au: positionDifference, endpoint_position_difference_km: positionDifference * AU_M / 1000,
      endpoint_velocity_difference_au_day: velocityDifference, fine_solution_error_estimate_au: positionDifference / 15,
      estimate_definition: 'RK4_step_halving_asymptotic_estimate_not_guaranteed_bound_or_physical_uncertainty',
      pure_kepler_endpoint_error_au: expected ? norm(sub(finalState.position_au, expected.position_au)) : null },
    energy: { diagnostic: 'solar_two_body_specific_energy', start_au2_day2: startEnergy, end_au2_day2: endEnergy,
      relative_change: (endEnergy - startEnergy) / Math.abs(startEnergy), sampled_min_au2_day2: fine.energyMin, sampled_max_au2_day2: fine.energyMax,
      solar_specific_angular_momentum_relative_change: norm(sub(h1, h0)) / norm(h0),
      expected_conserved_in_this_run: pureKepler, interpretation: pureKepler ? 'numerical_conservation_diagnostic_in_solar_Newtonian_test' : 'changes_include_physical_forcing_or_1PN_definition_terms_not_a_total_energy_error' },
    model_manifest_sha256: model?.source_manifest_sha256 ?? null,
    sources: [{ url: 'https://ssd.jpl.nasa.gov/astro_par.html', role: 'DE440_GM_and_constants' },
      { url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', role: 'prescribed_planetary_fit_positions' },
      { url: 'https://doi.org/10.3847/PSJ/acc9a9', role: 'optional_solar_1PN_equation_1' }], limitations: [...OMISSIONS] };
}
module.exports = { gravityField, integrateParticle, solar1PN, constants: Object.freeze({ GM, EARTH_GM, ACCEL_SI, ALGORITHM }) };

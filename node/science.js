'use strict';
const { strict } = require('./storage');
const EARTH = 5.97217e24, RAD = Math.PI / 180;
function finite(value, low = -Infinity, high = Infinity) { return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high; }
function massScenario(source, input) {
  const target = source.targets[input.target_id];
  if (!target || !finite(input.density_kg_m3, 100, 10000)) throw new Error('invalid_mass_scenario');
  const analogue = input.analogue_id == null ? null : source.analogues[input.analogue_id];
  if (input.analogue_id != null && (!analogue || Math.abs(input.density_kg_m3 - analogue.density_kg_m3) >= 1e-8)) throw new Error('invalid_mass_scenario');
  const radius = target.radius_km, density = input.density_kg_m3;
  const useR = input.include_source_ranges && target.radius_low_km != null;
  const useD = input.include_source_ranges && analogue?.density_sigma_kg_m3 != null;
  const r0 = useR ? target.radius_low_km : radius, r1 = useR ? target.radius_high_km : radius;
  const d0 = useD ? density - analogue.density_sigma_kg_m3 : density, d1 = useD ? density + analogue.density_sigma_kg_m3 : density;
  if (![radius, r0, r1].every(v => finite(v, Number.MIN_VALUE)) || ![d0, d1].every(v => finite(v, 100, 10000))) throw new Error('invalid_mass_scenario');
  const volume = 4 * Math.PI / 3 * (radius * 1000) ** 3, mass = density * volume;
  const low = d0 * (4 * Math.PI / 3) * (r0 * 1000) ** 3, high = d1 * (4 * Math.PI / 3) * (r1 * 1000) ** 3;
  const min = .001239 * target.semimajor_axis_au ** (9 / 8), pi = mass / EARTH / min, required = min * EARTH / volume;
  const bounded = useR || useD;
  return strict({ status: 'hypothesis', algorithm_version: 'spherical-density-hypothesis-v1', radius_km: radius, density_kg_m3: density, volume_shape: 'assumed_sphere', volume_m3: volume, mass_kg: mass, mass_earth: mass / EARTH, earth_mass_kg: EARTH,
    mass_bounds: bounded ? { low_kg: low, high_kg: high, low_earth: low / EARTH, high_earth: high / EARTH, radius_low_km: r0, radius_high_km: r1, density_low_kg_m3: d0, density_high_kg_m3: d1, definition: 'parameter_corner_range_not_confidence_interval' } : null,
    clearing: { minimum_mass_earth: min, pi, status: 'conditional_hypothesis', model_classification: pi >= 1 ? 'meets_model' : 'below_model', semimajor_axis_au: target.semimajor_axis_au, required_density_kg_m3_at_this_assumed_radius: required, required_density_for_model_kg_m3: required, required_density_exceeds_operating_max: required > 10000,
      pi_bounds: bounded ? { low: low / EARTH / min, high: high / EARTH / min, definition: 'parameter_corner_range_not_confidence_interval' } : null,
      parameter_range_classification: bounded ? (high / EARTH / min < 1 ? 'below_model' : low / EARTH / min >= 1 ? 'meets_model' : 'straddles_model') : null, evaluation_scope: 'circular_solar_10gyr_reference_not_eccentric_clearing_solution' },
    replaces_measured_mass: false, changes_official_classification: false, inputs: input, source_manifest_sha256: source.source_manifest_sha256 });
}
function calendarMs(year, month = 1, day = 1, hour = 0) {
  if (![year, month, day].every(Number.isSafeInteger) || !finite(year, -2999, 3000) || !finite(month, 1, 12) || !finite(day, 1, 31) || !finite(hour, 0, 24) || hour === 24) throw new Error('unsupported_simulation_date');
  const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('unsupported_simulation_date');
  return date.getTime() + hour * 3600000;
}
function position(body, jd) {
  const T = (jd - 2451545) / 36525;
  const [a, e, inc, L, p, node] = body.elements_j2000.map((v, i) => v + T * body.rates_per_century[i]);
  const extra = body.additional_terms;
  let M = L - p + extra.b * T * T + extra.c * Math.cos(extra.f * T * RAD) + extra.s * Math.sin(extra.f * T * RAD);
  M = (((M + 180) % 360 + 360) % 360 - 180) * RAD;
  let E = M + e * Math.sin(M), converged = false;
  for (let i = 0; i < 30; i++) { const delta = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E)); E += delta; if (Math.abs(delta) < 1e-14) { converged = true; break; } }
  if (!converged || a <= 0 || e < 0 || e >= 1) throw new Error('simulation_source_unavailable');
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E), w = (p - node) * RAD, O = node * RAD, I = inc * RAD;
  return [(Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * x + (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * y,
    (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * x + (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * y,
    Math.sin(w) * Math.sin(I) * x + Math.cos(w) * Math.sin(I) * y];
}
function longTerm(model, year, month = 1, day = 1, hour = 0) {
  const ms = calendarMs(year, month, day, hour), jd = calendarMs(year, month, day) / 86400000 + 2440587.5 + hour / 24, fit = model.tables.long;
  if (ms < calendarMs(...dateArgs(fit.coverage.min_date)) || ms > calendarMs(...dateArgs(fit.coverage.max_date))) throw new Error('unsupported_simulation_date');
  return strict({ algorithm_version: model.algorithm_version, source_manifest_sha256: model.source_manifest_sha256, calendar_date: { year, month, day, hour }, jd_tdb: jd, table: 'long', position_kind: 'approximate_simulation', coordinate_frame: model.frame, center: model.center, time_scale: model.time_scale, calendar: model.calendar, position_unit: model.position_unit,
    objects: fit.bodies.map(v => ({ object_id: v.object_id, model_body_id: v.model_body_id, name: v.name, position_au: position(v, jd), position_kind: 'approximate_simulation', position_identity: v.position_identity, nominal_errors: v.nominal_errors })), unsupported: model.unsupported, limitations: model.limitations });
}
function dateArgs(value) { return [value.year, value.month, value.day]; }
function hermite(p0, v0, p1, v1, u, days) {
  if (!finite(u, 0, 1) || !finite(days, Number.MIN_VALUE) || ![p0, v0, p1, v1].every(v => Array.isArray(v) && v.length === 3 && v.every(x => finite(x)))) throw new Error('invalid_interpolation');
  if (u === 0) return { position: [...p0], velocity: [...v0] }; if (u === 1) return { position: [...p1], velocity: [...v1] };
  return { position: p0.map((p, i) => (2 * u ** 3 - 3 * u ** 2 + 1) * p + (u ** 3 - 2 * u ** 2 + u) * days * v0[i] + (-2 * u ** 3 + 3 * u ** 2) * p1[i] + (u ** 3 - u ** 2) * days * v1[i]),
    velocity: p0.map((p, i) => (6 * u * u - 6 * u) / days * p + (3 * u * u - 4 * u + 1) * v0[i] + (-6 * u * u + 6 * u) / days * p1[i] + (3 * u * u - 2 * u) * v1[i]) };
}
function timelineScene(base, timeline, epoch) {
  if (typeof epoch !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(epoch)) throw new Error('unsupported_model_epoch');
  const parts = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d+))?)?(?:Z|[+-]\d\d:\d\d)$/.exec(epoch);
  if (!parts || Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6] || 0) > 59) throw new Error('unsupported_model_epoch');
  const calendar = new Date(0); calendar.setUTCFullYear(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (calendar.getUTCFullYear() !== Number(parts[1]) || calendar.getUTCMonth() !== Number(parts[2]) - 1 || calendar.getUTCDate() !== Number(parts[3])) throw new Error('unsupported_model_epoch');
  const ms = Date.parse(epoch), knots = timeline.knots;
  if (!finite(ms, Date.parse(timeline.start_epoch), Date.parse(timeline.end_epoch))) throw new Error('unsupported_model_epoch');
  let index = knots.findIndex((k, i) => i < knots.length - 1 && ms >= Date.parse(k.epoch) && ms <= Date.parse(knots[i + 1].epoch));
  if (index < 0) index = knots.length - 2;
  const a = knots[index], b = knots[index + 1], exact = knots.find(k => Date.parse(k.epoch) === ms), u = (ms - Date.parse(a.epoch)) / (Date.parse(b.epoch) - Date.parse(a.epoch)), days = b.tdb_jd - a.tdb_jd;
  const text = new Date(ms).toISOString().replace('.000Z', 'Z');
  const interpolation = { method: exact ? 'none' : 'cubic_hermite', time_coordinate: 'TDB', time_mapping: 'linear_between_saved_utc_tdb_knots', algorithm_version: 'display-hermite-v1', source_epochs: [a.epoch, b.epoch], fraction: u };
  const scene = structuredClone(base);
  Object.assign(scene, { epoch: text, position_sampling: exact ? 'source_exact' : 'display_interpolation', interpolation, guide_reference_epoch: timeline.guide_reference_epoch, timeline_algorithm_version: 'display-hermite-v1' });
  scene.limitations = [...scene.limitations, 'The Node display maps UTC linearly between the saved UTC/TDB knots, matching the browser display approximation. This is not a precise UTC-to-TDB conversion; original knot vectors are returned exactly.'];
  for (const body of scene.objects) {
    const id = body.object_id;
    if (a.states[id]) {
      const state = exact ? { position: exact.states[id].position_au, velocity: exact.states[id].velocity_au_day } : hermite(a.states[id].position_au, a.states[id].velocity_au_day, b.states[id].position_au, b.states[id].velocity_au_day, u, days);
      Object.assign(body, { position_au: state.position, velocity_au_day: state.velocity, position_kind: exact ? 'geometric_ephemeris_sample' : 'interpolated_ephemeris', position_epoch_utc: text, interpolation });
    } else if (a.directions[id]) {
      const direction = exact ? exact.directions[id].direction_ecliptic : a.directions[id].direction_ecliptic.map((v, i) => (1 - u) * v + u * b.directions[id].direction_ecliptic[i]);
      const length = Math.hypot(...direction), [x, y, z] = direction.map(v => v / length), obl = 84381.448 / 3600 * RAD;
      Object.assign(body, { direction_ecliptic: exact ? direction : [x, y, z], direction_icrs_deg: exact ? exact.directions[id].direction_icrs_deg : { ra: (Math.atan2(y * Math.cos(obl) - z * Math.sin(obl), x) / RAD + 360) % 360, dec: Math.asin(y * Math.sin(obl) + z * Math.cos(obl)) / RAD }, direction_epoch_utc: text, position_kind: exact ? 'catalog_proper_motion_direction' : 'interpolated_catalog_direction' });
    }
  }
  return scene;
}
module.exports = { finite, calendarMs, position, longTerm, massScenario, hermite, timelineScene };

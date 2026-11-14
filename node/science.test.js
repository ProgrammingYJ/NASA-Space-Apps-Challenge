'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { massScenario, position, longTerm, calendarMs, hermite, timelineScene } = require('./science');
const root = path.join(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const near = (actual, expected, relative = 2e-13) => assert.ok(Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), 1e-100), `${actual} != ${expected}`);

test('all 36 adopted source density/radius corners match the frozen Python calculation', () => {
  const source = read('data/manifests/mass_scenarios.json');
  for (const [target, row] of Object.entries(source.targets)) for (const [analogue, expected] of Object.entries(row.analogue_scenarios)) {
    const actual = massScenario(source, { target_id: target, density_kg_m3: source.analogues[analogue].density_kg_m3, analogue_id: analogue, include_source_ranges: true });
    for (const key of ['volume_m3', 'mass_kg', 'mass_earth']) near(actual[key], expected[key]);
    for (const key of ['low_kg', 'high_kg', 'low_earth', 'high_earth']) near(actual.mass_bounds[key], expected.mass_bounds[key]);
    near(actual.clearing.pi, expected.clearing.pi); near(actual.clearing.pi_bounds.high, expected.clearing.pi_bounds.high);
    assert.equal(actual.replaces_measured_mass, false); assert.equal(actual.changes_official_classification, false);
  }
});
test('custom density has no borrowed moon error and invalid analogue inputs are rejected', () => {
  const source = read('data/manifests/mass_scenarios.json');
  const value = massScenario(source, { target_id: 'sedna', density_kg_m3: 1000, analogue_id: null, include_source_ranges: false });
  assert.equal(value.mass_bounds, null); assert.equal(value.clearing.pi_bounds, null);
  for (const density of [99, 10001, NaN, Infinity, '1000', true]) assert.throws(() => massScenario(source, { target_id: 'sedna', density_kg_m3: density, analogue_id: null, include_source_ranges: true }));
  assert.throws(() => massScenario(source, { target_id: 'sedna', density_kg_m3: 1000, analogue_id: 'tethys', include_source_ranges: true }));
});
test('80 vectors match the prior Python/TypeScript parity fixture including astronomical year zero', () => {
  const fixture = read('web/src/longTermParity.fixture.json');
  let count = 0;
  for (const row of fixture.cases) {
    const date = row.calendar_date, ms = calendarMs(date.year, date.month, date.day, date.hour);
    assert.equal(ms, row.calendar_ms); assert.equal(ms / 86400000 + 2440587.5, row.jd_tdb);
    for (const expected of row.objects) {
      const body = fixture.model.tables.long.bodies.find(v => v.object_id === expected.object_id || v.object_id === expected.model_body_id);
      const actual = position(body, row.jd_tdb);
      assert.ok(Math.hypot(...actual.map((x, i) => x - expected.position_au[i])) < 2e-10);
      count++;
    }
  }
  assert.equal(count, 80);
  assert.notEqual(calendarMs(0), calendarMs(1900));
  for (const date of [[2026, 2, 30], [1, 2, 29], [-3000, 1, 1], [3001, 1, 1], [2026, 1, 1, 24]]) assert.throws(() => calendarMs(...date));
});
test('exported Python endpoint samples match long-term positions and original Hermite knots', () => {
  const base = read('data/node-runtime/snapshots/universe.json'), timeline = read('data/node-runtime/snapshots/timeline.json');
  const fixture = read('data/node-runtime/snapshots/python_parity_samples.json'), model = read('data/node-runtime/snapshots/long_term_model.json');
  for (const row of fixture.long_term) {
    const q = row.request, actual = longTerm(model, q.year, q.month, q.day, q.hour);
    assert.equal(actual.jd_tdb, row.response.jd_tdb);
    for (let i = 0; i < actual.objects.length; i++) assert.ok(Math.hypot(...actual.objects[i].position_au.map((v, k) => v - row.response.objects[i].position_au[k])) < 2e-10);
  }
  for (const knot of timeline.knots) {
    const actual = timelineScene(base, timeline, knot.epoch); assert.equal(actual.position_sampling, 'source_exact');
    for (const body of actual.objects) if (knot.states[body.object_id]) { assert.deepEqual(body.position_au, knot.states[body.object_id].position_au); assert.deepEqual(body.velocity_au_day, knot.states[body.object_id].velocity_au_day); }
    assert.equal(actual.objects.find(v => v.object_id === 'epsilon-indi-b').direction_epoch_utc, knot.epoch);
  }
  for (const row of fixture.universe) {
    const actual = timelineScene(base, timeline, row.request.epoch);
    for (const body of actual.objects) if (body.position_au) { const expected = row.response.objects.find(v => v.object_id === body.object_id); assert.ok(Math.hypot(...body.position_au.map((v, k) => v - expected.position_au[k])) * 149597870.7 < .01); }
  }
  for (const epoch of ['2026-11-13T24:00:00Z', '2026-11-14T25:00Z', '2026-11-14T00:00:00', '2026-11-12T23:59:59Z']) assert.throws(() => timelineScene(base, timeline, epoch));
});
test('Hermite endpoints and derivative retain original position/velocity', () => {
  assert.deepEqual(hermite([0, 0, 0], [1, 2, 3], [2, 4, 6], [1, 2, 3], .5, 2), { position: [1, 2, 3], velocity: [1, 2, 3] });
  assert.throws(() => hermite([0, 0, 0], [1, 2, 3], [2, 4, 6], [1, 2, 3], 1.1, 2));
});

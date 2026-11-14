'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createOuterCatalog, position, constants } = require('./outer-tno');
const { validator } = require('./schema');
const contract = require('../contracts/planet-nine.schema.json');
const validate = validator({ ...contract, components: { schemas: contract.$defs } });
const fixture = require('./outer-tno.fixture.json');
const root = path.join(__dirname, '..'), service = createOuterCatalog(root), catalog = service.catalog();
const norm = a => Math.hypot(...a);
test('complete dated JPL TNO snapshot preserves count, IDs, nulls and known-body mapping', () => {
  assert.equal(catalog.selection.reported_count, 8341); assert.equal(catalog.objects.length, 8341);
  assert.equal(new Set(catalog.objects.map(o => o.object_id)).size, 8341);
  assert.equal(catalog.selection.usable_orbit_count, 8340);
  assert.equal(catalog.source.sha256, fixture.source_snapshot_sha256);
  assert.equal(catalog.time_scale, 'TDB');
  const sedna = service.object('sbdb-20090377', catalog.reference_jd_tdb);
  assert.equal(sedna.known_object_id, 'sedna'); assert.equal(sedna.physical.mass_kg, null);
  assert.equal(sedna.physical.resolved_surface_available, false);
  assert.equal(typeof sedna.spkid, 'string');
  const unknown = catalog.objects.find(o => o.orbit === null); assert.ok(unknown);
  const missing = service.object(unknown.object_id, catalog.reference_jd_tdb);
  assert.equal(missing.position_au, null); assert.equal(missing.position_status, 'missing_or_unsupported_elements');
});
test('all reference states agree between independent Python and JS calculation paths', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/manifests/outer_tno.json')));
  let maximum = 0;
  for (const o of raw.objects) if (o.orbit) {
    const computed = position(o.orbit, raw.reference_jd_tdb);
    maximum = Math.max(maximum, norm(computed.map((v, i) => v - o.reference_position_au[i])));
    assert.ok(computed.every(Number.isFinite));
  }
  assert.ok(maximum < 1e-7, String(maximum)); // Numerical consistency, not physical accuracy.
});
test('three separate Horizons geometric queries check source-epoch elements in matching frame and time', () => {
  for (const row of fixture.checks) {
    const actual = position(row.orbit, row.epoch_jd_tdb), residual = norm(actual.map((v, i) => v - row.expected_position_au[i]));
    assert.ok(residual < 1e-8, row.name + ': ' + residual);
    assert.equal(row.source.parameters.TIME_TYPE, "'TDB'");
    assert.equal(row.source.parameters.CENTER, "'500@10'");
    assert.equal(row.source.parameters.VEC_CORR, "'NONE'");
    assert.equal(row.source.parameters.REF_PLANE, "'ECLIPTIC'");
  }
});
test('a q Q and date-dependent r are distinct, full ellipse remains beyond1000AU', () => {
  const sedna = service.object('sbdb-20090377', catalog.reference_jd_tdb);
  assert.ok(sedna.semimajor_axis_au > 500); assert.ok(sedna.perihelion_au > 70 && sedna.perihelion_au < 100);
  assert.ok(sedna.aphelion_au > 1000); assert.ok(sedna.radius_au < 100);
  assert.equal(sedna.full_orbit_au.length, 257); assert.deepEqual(sedna.full_orbit_au[0], sedna.full_orbit_au[256]);
  assert.ok(sedna.full_orbit_au.some(v => norm(v) > 1000));
  assert.equal(sedna.full_orbit_clipped_at_1000_au, false);
  const initial = service.scene(catalog.reference_jd_tdb);
  assert.equal(initial.plotted_count, 8340); assert.equal(initial.unavailable_count, 1);
  assert.equal(initial.plotted_count + initial.outside_1000_au_count + initial.unavailable_count, initial.catalogue_count);
  const other = service.scene(catalog.reference_jd_tdb + 10);
  assert.notDeepEqual(other.objects.find(o => o.object_id === sedna.object_id).position_au, sedna.position_au);
});
test('full Solar calendar remains populated with explicitly unvalidated long-range extrapolation', () => {
  assert.equal(catalog.algorithm_version, 'jpl-sbdb-tno-two-body-v2');
  assert.equal(catalog.source_algorithm_version, 'jpl-sbdb-tno-two-body-v1');
  assert.equal(catalog.propagation_operating_limit_days, null);
  const current = service.object('sbdb-20090377', catalog.reference_jd_tdb);
  for (const jd of [625697.5, 800283.5, 1721059.5, 2816787.5]) {
    const scene = service.scene(jd);
    assert.ok(scene.plotted_count > 8000, String(jd));
    assert.equal(scene.unavailable_count, 1);
    assert.equal(scene.plotted_count + scene.outside_1000_au_count + scene.unavailable_count, scene.catalogue_count);
    assert.equal(scene.extrapolated_count, 8340); assert.equal(scene.extrapolated_plotted_count, scene.plotted_count);
    const selected = service.object('sbdb-20090377', jd);
    assert.ok(selected.position_au.every(Number.isFinite)); assert.equal(selected.position_status, 'unvalidated_kepler_extrapolation');
    assert.equal(selected.long_range_extrapolation, true); assert.notDeepEqual(selected.position_au, current.position_au);
    assert.equal(selected.full_orbit_clipped_at_1000_au, false);
  }
});
test('crossing the old100-year cutoff changes a warning rather than erasing or freezing the source state', () => {
  const source = service.object('sbdb-20090377', catalog.reference_jd_tdb), epoch = source.orbit.epoch_jd_tdb;
  const a = service.object(source.object_id, epoch - constants.EXTRAPOLATION_WARNING_DAYS + .001);
  const b = service.object(source.object_id, epoch - constants.EXTRAPOLATION_WARNING_DAYS - .001);
  assert.equal(a.long_range_extrapolation, false); assert.equal(b.long_range_extrapolation, true);
  assert.ok(norm(a.position_au.map((v, i) => v - b.position_au[i])) < 1e-4);
});
test('malformed and out-of-Solar-calendar queries still fail explicitly', () => {
  assert.throws(() => service.scene(catalog.supported_calendar.min_jd_tdb - 1));
  assert.throws(() => service.scene(catalog.supported_calendar.max_jd_tdb + 1));
  assert.throws(() => service.scene(NaN)); assert.throws(() => service.object('../x', catalog.reference_jd_tdb));
});

test('runtime contracts require the new extrapolation metadata and preserve nullable source states', () => {
  assert.doesNotThrow(() => validate('OuterCatalogue', catalog));
  for (const jd of [catalog.reference_jd_tdb, 800283.5]) {
    assert.doesNotThrow(() => validate('OuterScene', service.scene(jd)));
    assert.doesNotThrow(() => validate('OuterObject', service.object('sbdb-20090377', jd)));
  }
  const absent = catalog.objects.find(o => o.orbit === null);
  assert.doesNotThrow(() => validate('OuterObject', service.object(absent.object_id, 800283.5)));
  const incomplete = { ...service.scene(800283.5) }; delete incomplete.extrapolated_count;
  assert.throws(() => validate('OuterScene', incomplete));
  assert.throws(() => validate('OuterCatalogue', { ...catalog, algorithm_version: 'jpl-sbdb-tno-two-body-v1' }));
});

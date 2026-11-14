'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validator } = require('./schema');
const { loadPresets, normalizeOrbit, skyPath, constants } = require('./planet-nine');
const { gravityField } = require('./solar-gravity');
const { createRegionCatalog } = require('./p9-regions');
const { createOuterCatalog } = require('./outer-tno');
const root = path.join(__dirname, '..');
const document = JSON.parse(fs.readFileSync(path.join(root, 'contracts/planet-nine.schema.json'), 'utf8'));
const validate = validator({ ...document, components: { schemas: document.$defs } });
test('versioned P9 runtime schema agrees with actual source, normalization and calculation outputs', () => {
  const presets = loadPresets(root); validate('Presets', presets);
  assert.equal(document.$defs.JulianDay.minimum, constants.MIN_JD); assert.equal(document.$defs.JulianDay.maximum, constants.MAX_JD);
  assert.deepEqual(Object.keys(document.$defs.Orbit.properties).sort(), Object.keys(presets.presets[0].orbit).sort());
  const orbit = presets.presets[0].orbit;
  assert.deepEqual(normalizeOrbit(validate('Orbit', orbit)), normalizeOrbit(orbit));
  const model = JSON.parse(fs.readFileSync(path.join(root, 'data/node-runtime/snapshots/long_term_model.json'), 'utf8'));
  const request = validate('PredictionInput', { orbit, start_jd_tdb: 2461312.5, end_jd_tdb: 2461315.5 });
  const prediction = skyPath(request, model); validate('Prediction', prediction);
  const gravity = gravityField(validate('GravityFieldInput', { position_au: [500, 0, 0], jd_tdb: request.start_jd_tdb }), model); validate('GravityFieldResult', gravity);
  assert.equal(prediction.request.observer, request.observer); assert.equal(prediction.path.length, request.samples);
  assert.throws(() => validate('Orbit', { ...orbit, e: 1 })); assert.throws(() => normalizeOrbit({ ...orbit, e: 1 }));
  assert.throws(() => validate('Orbit', { ...orbit, e: '0.2' })); assert.throws(() => normalizeOrbit({ ...orbit, e: '0.2' }));
  assert.throws(() => validate('PredictionInput', { ...request, observer: 'spherex' })); assert.throws(() => skyPath({ ...request, observer: 'spherex' }, model));
  assert.throws(() => validate('CoverageInput', { orbit, start_date: '2026-09-29', end_date: '2026-10-02', url: 'http://localhost' }));
  assert.throws(() => validate('IntegrationInput', { orbit, start_jd_tdb: request.start_jd_tdb, step_days: 5 }));
});
test('region filters and TNO response contracts agree with actual dated sources', () => {
  const catalog = createRegionCatalog(root), query = validate('RegionQuery', {});
  assert.deepEqual(query, { subset: 'ztf_des_ps1', max_reference_distance_au: 1000, offset: 0, limit: 20 });
  const page = catalog.regions(query); validate('RegionPage', page);
  const memberQuery = validate('RegionMembersQuery', {});
  assert.deepEqual(memberQuery, { subset: 'ztf_des_ps1', max_reference_distance_au: 1000, offset: 0, limit: 100 });
  const members = catalog.members(page.rows[0].cell_id, memberQuery); validate('RegionPage', members); validate('RegionMembersPage', members);
  const row = catalog.row(members.rows[0]); validate('PopulationRow', row);
  assert.equal(row.cell_id, page.rows[0].cell_id);
  assert.throws(() => validate('RegionQuery', { subset: 'unverified', max_reference_distance_au: 1000 }));
  assert.throws(() => validate('RegionQuery', { limit: 101 }));
  assert.throws(() => validate('RegionQuery', { max_reference_distance_au: 999 }));
  const outer = createOuterCatalog(root), objects = outer.catalog();
  validate('OuterCatalogue', objects); validate('OuterScene', outer.scene(objects.reference_jd_tdb));
});
test('member sample summaries require typed source values and preserve the legacy integer ID contract', () => {
  const catalog = createRegionCatalog(root), cell = catalog.regions({ limit: 1 }).rows[0].cell_id;
  const members = catalog.members(cell), sample = members.samples[0];
  assert.deepEqual(validate('PopulationSampleSummary', sample), sample);
  assert.equal(sample.row_index, members.rows[0]); assert.equal(members.limit, 100);
  const page = validate('RegionMembersPage', members);
  assert.deepEqual(page.rows, members.rows); assert.deepEqual(page.samples, members.samples);
  for (const patch of [
    { kind: 'observed_planet' }, { mass_earth: '6.14' }, { mass_earth: -1 }, { mass_earth: Infinity },
    { assumed_radius_earth: 0 }, { assumed_radius_earth: null }, { semimajor_axis_au: 0 },
    { eccentricity: 1 }, { row_index: '2413' }, { row_index: 100000 },
    { physical_density_kg_m3: 1000 }, { existence_probability: .5 },
  ]) assert.throws(() => validate('PopulationSampleSummary', { ...sample, ...patch }));
  const missingField = { ...sample }; delete missingField.mass_earth;
  assert.throws(() => validate('PopulationSampleSummary', missingField));
  const missingSamples = { ...members }; delete missingSamples.samples;
  assert.throws(() => validate('RegionMembersPage', missingSamples));
  assert.throws(() => validate('RegionMembersPage', { ...members, rows: [String(members.rows[0])] }));
  assert.throws(() => validate('RegionMembersPage', { ...members, samples: [{ ...sample, eccentricity: '0.139' }] }));
  assert.throws(() => validate('RegionMembersQuery', { limit: 101 }));
  assert.throws(() => validate('RegionMembersQuery', { limit: null }));
  const empty = catalog.members(cell, { offset: members.member_count });
  validate('RegionMembersPage', empty); assert.deepEqual(empty.rows, []); assert.deepEqual(empty.samples, []);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { createRegionCatalog, ang2pixRing, pix2angRing, constants } = require('./p9-regions');
const fixture = require('./p9-regions.fixture.json');
const catalog = createRegionCatalog(path.join(__dirname, '..'));
test('HEALPix RING agrees with independent astropy-healpix cases and all100000 source pixels', () => {
  for (const row of fixture.cases) assert.ok(row.allowed_boundary_pixels.includes(ang2pixRing(32, row.ra_deg, row.dec_deg)), JSON.stringify(row));
  assert.equal(catalog.summary().source.cell_mapping_uint32le_sha256, fixture.full_population_pixel_indices_uint32le_sha256);
  assert.equal(catalog.summary().source.sha256, fixture.csv_sha256);
  for (const row of fixture.centers) {
    const point = pix2angRing(32, row.pixel);
    assert.ok(Math.abs(point.ra_deg - row.ra_deg) < 2e-12);
    assert.ok(Math.abs(point.dec_deg - row.dec_deg) < 2e-12);
  }
});
test('all cells have equal area and independently computed centers map back to the same cell', () => {
  assert.ok(Math.abs(constants.NPIX * constants.AREA - 4 * Math.PI) < 1e-13);
  for (let i = 0; i < constants.NPIX; i++) { const center = pix2angRing(32, i); assert.equal(ang2pixRing(32, center.ra_deg, center.dec_deg), i); }
});
test('author survey filtering and reference-distance renormalization retain explicit denominators', () => {
  const all = catalog.summary({ subset: 'all', max_reference_distance_au: null }); assert.equal(all.selection.selected_count, 100000);
  const remaining = catalog.summary({ max_reference_distance_au: null }); assert.equal(remaining.selection.selected_count, 21740);
  const selected = catalog.summary(); assert.equal(selected.selection.selected_count, 20406);
  assert.equal(selected.selection.remaining_fraction_of_original, .20406);
  assert.equal(selected.selection.survey_remaining_fraction_of_original, .2174);
  assert.equal(selected.existence_probability, null);
  let probability = 0, count = 0, previous = null;
  for (let offset = 0; offset < selected.total_nonempty_cells; offset += 100) for (const row of catalog.regions({ offset, limit: 100 }).rows) {
    probability += row.conditional_probability; count += row.count;
    assert.ok(Math.abs(row.conditional_probability - row.density_sr_inv * selected.cell_area_sr) < 1e-18);
    if (previous) assert.ok(previous.count > row.count || previous.count === row.count && previous.cell_id < row.cell_id);
    previous = row;
  }
  assert.equal(count, 20406); assert.ok(Math.abs(probability - 1) < 1e-13);
});
test('a ranked region resolves actual row indices and source elements without fabricated candidate probabilities', () => {
  const region = catalog.regions({ limit: 1 }).rows[0], ids = catalog.members(region.cell_id, { limit: 100 });
  assert.equal(ids.member_count, region.count); assert.equal(ids.rows.length, region.count);
  for (const index of ids.rows) {
    const row = catalog.row(index); assert.equal(row.cell_id, region.cell_id); assert.equal(row.row_index, index);
    assert.equal(row.source_columns.ZTF, 0); assert.equal(row.source_columns.DES, 0); assert.equal(row.source_columns.PS1, 0);
    assert.ok(row.source_columns.R <= 1000); assert.equal(row.orbit.epoch_jd_tdb, 2458270); assert.equal(row.individual_existence_probability, null);
    assert.ok(Math.abs(((row.orbit.omega_deg + row.source_columns.Omega) % 360) - row.source_columns.varpi) < 2e-12);
  }
  assert.ok(catalog.row(99999).orbit.a_au > 0);
});
test('member summaries preserve integer IDs, source units and the same immutable CSV rows', () => {
  const region = catalog.regions({ limit: 1 }).rows[0], result = catalog.members(region.cell_id);
  assert.equal(region.cell_id, 3682); assert.equal(result.limit, 100); assert.equal(result.member_count, 65);
  assert.equal(result.next_offset, null); assert.equal(result.rows.length, 65); assert.equal(result.samples.length, result.rows.length);
  // Independently transcribed original CSV row 2413, not a value calculated by
  // this summary implementation. These are literature-model sample parameters.
  assert.deepEqual(result.samples[0], { id: 'caltech-row-2413', row_index: 2413, kind: 'synthetic_literature_sample',
    mass_earth: 6.14, assumed_radius_earth: 2.05, semimajor_axis_au: 390.78, eccentricity: .139 });
  for (const [position, index] of result.rows.entries()) {
    assert.ok(Number.isInteger(index));
    const sample = result.samples[position], full = catalog.row(index), columns = full.source_columns;
    assert.equal(sample.id, full.id); assert.equal(sample.row_index, index); assert.equal(sample.kind, full.kind);
    assert.equal(sample.mass_earth, columns.mass); assert.equal(sample.mass_earth, full.orbit.mass_earth);
    assert.equal(sample.assumed_radius_earth, columns.rad); assert.equal(sample.semimajor_axis_au, columns.a); assert.equal(sample.eccentricity, columns.e);
  }
  assert.deepEqual(result.source, catalog.summary().source); assert.deepEqual(result.selection, catalog.summary().selection);
  assert.equal(result.existence_probability, null); assert.equal(result.individual_candidate_authenticity_probability, null);
  assert.equal(catalog.regions().limit, 20); assert.equal('samples' in catalog.regions(), false);
});
test('member summary pagination stays aligned and never invents samples for an empty page', () => {
  const cell = catalog.regions({ limit: 1 }).rows[0].cell_id, full = catalog.members(cell);
  const partial = catalog.members(cell, { offset: 2, limit: 3 });
  assert.equal(partial.limit, 3); assert.equal(partial.next_offset, 5);
  assert.deepEqual(partial.rows, full.rows.slice(2, 5)); assert.deepEqual(partial.samples, full.samples.slice(2, 5));
  assert.equal(partial.member_count, full.member_count); assert.deepEqual(partial.source, full.source); assert.deepEqual(partial.selection, full.selection);
  const empty = catalog.members(cell, { offset: 65 });
  assert.equal(empty.limit, 100); assert.equal(empty.next_offset, null); assert.deepEqual(empty.rows, []); assert.deepEqual(empty.samples, []);
  for (const input of [{ limit: 101 }, { limit: null }, { offset: -1 }]) assert.throws(() => catalog.members(cell, input));
});
test('malformed pages, filters and coordinates fail closed', () => {
  for (const input of [{ limit: 101 }, { offset: -1 }, { limit: null }, { subset: 'latest' }, { max_reference_distance_au: NaN }, { unknown: true }]) assert.throws(() => catalog.regions(input));
  for (const index of [-1, 100000, 1.2, '3']) assert.throws(() => catalog.row(index));
  assert.throws(() => ang2pixRing(32, Infinity, 0)); assert.throws(() => ang2pixRing(3, 0, 0)); assert.throws(() => pix2angRing(32, 12288));
});

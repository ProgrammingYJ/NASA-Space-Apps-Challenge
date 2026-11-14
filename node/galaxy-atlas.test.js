'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { atlasSelection } = require('./galaxy-atlas');
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/node-runtime/snapshots/galaxy_atlas.json'), 'utf8'));
test('actual GWGC page projection retains all 18 native fields, errors and identity without fabricated members', () => {
  const page = atlasSelection(catalogue, {limit: 1});
  assert.equal(page.record_count, 53162); assert.equal(page.matched_count, 53162); assert.equal(page.next_cursor, '1');
  assert.equal(page.objects[0].object_id, 'gwgc-pgc-2'); assert.equal(page.objects[0].ra_deg, .007);
  assert.equal(page.objects[0].distance_native_mpc, 72.46); assert.equal(page.objects[0].distance_error_mpc, 10.87);
  assert.equal(page.objects[0].coordinate_reference, 'FK5 J2000 catalogue reference');
  assert.equal(page.objects[0].surface_resolved, false); assert.equal(page.objects[0].individual_stars_or_planets_inferred, false);
  assert.equal(page.rows, undefined); assert.equal(page.columns, undefined);
  const last = atlasSelection(catalogue, {cursor:'53161'}); assert.equal(last.objects.length, 1); assert.equal(last.next_cursor, null);
});
test('GWGC exact aliases, unknown morphology and Unicode queries do not silently select every galaxy', () => {
  const m31 = atlasSelection(catalogue, {query:'Messier 31'}).objects;
  assert.equal(m31.length, 1); assert.equal(m31[0].object_id, 'gwgc-pgc-2557'); assert.equal(m31[0].existing_object_id, 'galaxy-m31');
  assert.deepEqual(atlasSelection(catalogue, {query:'NGC224'}).objects, atlasSelection(catalogue, {query:'NGC0224'}).objects);
  assert.ok(atlasSelection(catalogue, {query:'NGC598'}).objects.some(row=>row.existing_object_id==='galaxy-m33'));
  assert.deepEqual(atlasSelection(catalogue, {id:m31[0].object_id}), {...m31[0], source_manifest_sha256: catalogue.source_manifest_sha256});
  assert.equal(atlasSelection(catalogue, {query:'은하'}).matched_count, 0);
  const unknown = catalogue.rows.find(row => row[4] === null);
  assert.equal(atlasSelection(catalogue, {id:'gwgc-pgc-'+unknown[0]}).morphology, null);
  assert.equal(atlasSelection(catalogue, {id:'gwgc-pgc-9999999'}), null);
});
test('GWGC cursor, IDs and page-size limits are closed and bounded', () => {
  for(const key of [{cursor:'-1'},{cursor:'01'},{cursor:'53163'},{limit:201},{limit:0},{query:'x'.repeat(201)},{id:'__proto__'},{id:'gwgc-pgc-0002'}]) assert.throws(()=>atlasSelection(catalogue,key),/invalid_galaxy_atlas_selection/);
});

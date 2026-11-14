'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./server');
const root = path.join(__dirname, '..');
const emptyTable = '|ra_obj      |dec_obj     |observationid       |uri                 |\n|double      |double      |char                |char                |\n';
test('public 1000 AU scope and actual P9 HTTP save/export/fresh import survive Node restart', { timeout: 180000 }, async t => {
  const stateDir = fs.mkdtempSync(path.join(root, 'tmp', 'p9-http-'));
  let runtime = await start({ root, stateDir, host: '127.0.0.1', port: 0, noSignals: true, mostFetcher: async () => new Response(emptyTable) });
  let base = 'http://127.0.0.1:' + runtime.server.address().port;
  const call = async (route, body) => { const response = await fetch(base + '/api/v1/' + route, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); const raw = await response.text(); return { status: response.status, value: JSON.parse(raw), raw }; };
  let saved, exported, regional;
  try {
    await t.test('removed API families are gated while observational and Solar System sources remain available', async () => {
      const flags = await call('runtime'); assert.equal(flags.status, 200); assert.equal(flags.value.public_scope, 'solar_system_1000au');
      assert.equal(flags.value.feature_flags.galaxies, false); assert.equal(flags.value.physics_capabilities.all_physics, false);
      for (const route of ['black-holes', 'observer-physics', 'cosmic-history', 'cosmic-history/sample', 'cosmic-observations', 'physics/numerical-relativity', 'catalog/galaxies', 'catalog/galaxy-atlas', 'catalog/exoplanets', 'catalog/exoplanets/anything', 'catalog/exoplanet-observations', 'catalog/extragalactic-planets', 'catalog/universe']) assert.equal((await call(route)).status, 410, route);
      assert.equal((await call('observations?object_id=epsilon-indi-b')).status, 200);
      assert.equal((await call('observations?object_id=pluto')).status, 200);
      assert.equal((await call('catalog/solar-system')).value.objects.length, 476);
    });
    await t.test('real source presets drive prediction, gravity, coverage and independent evidence contract', async () => {
      const source = await call('planet-nine/presets'); assert.equal(source.status, 200); assert.equal(source.value.presets.length, 3); assert.equal(source.value.source.epoch_discrepancy, true);
      const preset = source.value.presets[0], orbit = preset.orbit;
      const request = { orbit, start_jd_tdb: 2461312.5, end_jd_tdb: 2461315.5, samples: 4, observer: 'earth_moon_barycenter' };
      const prediction = await call('planet-nine/predict', request); assert.equal(prediction.status, 200, prediction.raw); assert.equal(prediction.value.path.length, 4); assert.equal(prediction.value.assumptions.measured_motion, false);
      const gravity = await call('planet-nine/gravity-field', { position_au: prediction.value.path[0].position_au, jd_tdb: request.start_jd_tdb, include_planets: true }); assert.equal(gravity.status, 200, gravity.raw); assert.ok(gravity.value.direct_magnitude_m_s2 > 0);
      const integrated = await call('planet-nine/integrate', { orbit, start_jd_tdb: request.start_jd_tdb, duration_days: 8, step_days: 1, include_planets: false, include_solar_gr_1pn: false }); assert.equal(integrated.status, 200, integrated.raw); assert.equal(integrated.value.integrator.step_halving, true);
      const coverage = await call('planet-nine/coverage', { orbit, start_date: '2026-09-29', end_date: '2026-10-02' }); assert.equal(coverage.status, 200); assert.equal(coverage.value.status, 'no_coverage'); assert.equal(coverage.value.claim, 'predicted_footprint_overlap_only');
      const result = await call('planet-nine/evidence', { orbit, prediction: prediction.value, gravity: { kind: 'field', result: gravity.value }, coverage: coverage.value, judgment: '촬영 범위만 검토함', locale: 'ko', source: { preset_id: preset.id, row_index: preset.row_index, source_sha256: source.value.source.sha256 } });
      assert.equal(result.status, 201, result.raw); saved = result.value;
      assert.equal(saved.payload.gravity.kind, 'field'); assert.equal('result_id' in saved, false);
      exported = await call('planet-nine/evidence/' + saved.evidence_id + '/export'); assert.equal(exported.status, 200); assert.deepEqual(exported.value, saved);
      const mismatch = structuredClone(saved.payload); mismatch.orbit.a_au += 1; assert.equal((await call('planet-nine/evidence', mismatch)).status, 409);
      const tampered = structuredClone(saved); tampered.payload.coverage.raw_response += 'x'; assert.equal((await call('planet-nine/evidence/import', tampered)).status, 409);
      assert.equal((await call('planet-nine/predict', { ...request, observer: 'spherex' })).status, 422);
      assert.equal((await call('planet-nine/coverage', { orbit, start_date: '2026-02-30', end_date: '2026-03-01' })).status, 422);
      assert.equal((await call('planet-nine/coverage', { orbit, start_date: '2026-09-29', end_date: '2026-10-02', url: 'http://localhost/' })).status, 422);
    });
    await t.test('genuine other-date coverage and gravity cannot be attached to a shared-date evidence session', async () => {
      const { canonical, hash } = require('./storage');
      const shiftedCoverage = await call('planet-nine/coverage', { orbit: saved.payload.orbit, start_date: '2026-09-30', end_date: '2026-10-03' });
      assert.equal(shiftedCoverage.status, 200); assert.equal(shiftedCoverage.value.status, 'no_coverage');
      const otherField = await call('planet-nine/gravity-field', { position_au: [500, 0, 0], jd_tdb: saved.payload.prediction.request.start_jd_tdb + 1 });
      const otherIntegration = await call('planet-nine/integrate', { orbit: saved.payload.orbit, start_jd_tdb: saved.payload.prediction.request.start_jd_tdb + 1, duration_days: 2, step_days: 1 });
      assert.equal(otherField.status, 200, otherField.raw); assert.equal(otherIntegration.status, 200, otherIntegration.raw);
      for (const [patch, code] of [
        [{ coverage: shiftedCoverage.value }, 'coverage_date_selection_mismatch'],
        [{ gravity: { kind: 'field', result: otherField.value } }, 'gravity_date_selection_mismatch'],
        [{ gravity: { kind: 'integration', result: otherIntegration.value } }, 'gravity_date_selection_mismatch'],
      ]) {
        const input = { ...saved.payload, ...patch }, rejected = await call('planet-nine/evidence', input);
        assert.equal(rejected.status, 409, rejected.raw); assert.equal(rejected.value.code, code);
        const imported = { ...structuredClone(saved), payload: input, payload_sha256: hash(canonical(input)) };
        const rejectedImport = await call('planet-nine/evidence/import', imported);
        assert.equal(rejectedImport.status, 409, rejectedImport.raw); assert.equal(rejectedImport.value.code, code);
      }
      assert.equal((await call('planet-nine/evidence/' + saved.evidence_id + '/export')).raw, exported.raw);
    });
    await t.test('ranked source membership is saved and validated separately from the hypothesis path', async () => {
      const page = (await call('planet-nine/regions?limit=1')).value;
      const cell = page.rows[0].cell_id, members = (await call('planet-nine/regions/' + cell + '/members?limit=1')).value;
      const row = (await call('planet-nine/population/' + members.rows[0])).value;
      const prediction = await call('planet-nine/predict', { orbit: row.orbit, start_jd_tdb: 2461312.5, end_jd_tdb: 2461315.5, samples: 4 });
      const result = await call('planet-nine/evidence', { orbit: row.orbit, prediction: prediction.value, judgment: 'Source-epoch region and editable propagated path remain separate.', locale: 'en', source: { preset_id: row.id, row_index: row.row_index, source_sha256: row.source_sha256 }, region_context: { subset: 'ztf_des_ps1', max_reference_distance_au: 1000, cell_id: cell, row_index: row.row_index } });
      assert.equal(result.status, 201, result.raw); regional = result.value;
      assert.deepEqual(regional.payload.region_context, { subset: 'ztf_des_ps1', max_reference_distance_au: 1000, cell_id: cell, row_index: row.row_index });
      const wrongCell = structuredClone(regional.payload); wrongCell.region_context.cell_id = (cell + 1) % 12288;
      assert.equal((await call('planet-nine/evidence', wrongCell)).status, 409);
      const edited = structuredClone(regional.payload); edited.orbit.a_au += 1;
      edited.prediction = (await call('planet-nine/predict', { ...prediction.value.request, orbit: edited.orbit })).value;
      assert.equal((await call('planet-nine/evidence', edited)).status, 409);
    });
    await runtime.close();
    runtime = await start({ root, stateDir, host: '127.0.0.1', port: 0, noSignals: true, mostFetcher: async () => { throw new Error('offline'); } });
    base = 'http://127.0.0.1:' + runtime.server.address().port;
    await t.test('same P9 IDs and raw response restore after restart without MOST; offline MOST does not break readiness', async () => {
      const same = await call('planet-nine/evidence/' + saved.evidence_id + '/export'); assert.equal(same.raw, exported.raw);
      const restored = await call('planet-nine/evidence/import', saved); assert.equal(restored.status, 200, restored.raw); assert.equal(restored.value.status, 'restored'); assert.equal(restored.value.evidence.evidence_id, saved.evidence_id); assert.equal(restored.value.evidence.payload.coverage.raw_response, emptyTable);
      const failed = await call('planet-nine/coverage', { orbit: saved.payload.orbit, start_date: '2026-10-03', end_date: '2026-10-04' }); assert.equal(failed.value.status, 'service_error'); assert.equal(failed.value.error.code, 'offline');
      assert.equal((await fetch(base + '/health/ready')).status, 200);
    });
    await runtime.close();
    const freshState = fs.mkdtempSync(path.join(root, 'tmp', 'p9-fresh-http-'));
    runtime = await start({ root, stateDir: freshState, host: '127.0.0.1', port: 0, noSignals: true, mostFetcher: async () => { throw new Error('offline'); } });
    base = 'http://127.0.0.1:' + runtime.server.address().port;
    await t.test('an independent empty Node state restores and reexports imported coverage without the old cache', async () => {
      assert.equal((await call('planet-nine/evidence/' + saved.evidence_id + '/export')).status, 404);
      const restored = await call('planet-nine/evidence/import', exported.value); assert.equal(restored.status, 200, restored.raw); assert.equal(restored.value.status, 'restored');
      assert.equal((await call('planet-nine/evidence/' + saved.evidence_id + '/export')).raw, exported.raw);
      const collision = structuredClone(saved); collision.payload.judgment = 'different record with same ID';
      const { canonical, hash } = require('./storage'); collision.payload_sha256 = hash(canonical(collision.payload));
      assert.equal((await call('planet-nine/evidence/import', collision)).status, 409);
      const regionRestore = await call('planet-nine/evidence/import', regional);
      assert.equal(regionRestore.value.status, 'restored', regionRestore.raw);
      assert.deepEqual(regionRestore.value.evidence.payload.region_context, regional.payload.region_context);
    });
  } finally { await runtime.close(); }
});

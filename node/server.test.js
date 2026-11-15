'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { start } = require('./server');
const { parse, hash, atomic } = require('./storage');
const root = path.join(__dirname, '..');
const read = name => parse(fs.readFileSync(path.join(root, 'data/node-runtime/snapshots', name + '.json'), 'utf8'));

test('real exported bundle serves UI contracts, source-verified comparison and evidence across restart', { timeout: 180000 }, async t => {
  const state = fs.mkdtempSync(path.join(root, 'tmp', 'node-http-test-'));
  let runtime = await start({ root, stateDir: state, port: 0, host: '127.0.0.1', noSignals: true });
  let base = 'http://127.0.0.1:' + runtime.server.address().port;
  const request = async (route, body) => {
    const response = await fetch(base + route, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch {}
    return { status: response.status, value, text, headers: response.headers };
  };
  const api = '/api/v1/';
  const complete = async ids => {
    const response = await request(api + 'comparison-jobs', { observation_ids: ids }); assert.equal(response.status, 202);
    for (let i = 0; i < 150; i++) { const job = (await request(api + 'jobs/' + response.value.job_id)).value; if (job.state === 'succeeded') return job; assert.ok(!['failed', 'interrupted', 'cancelled'].includes(job.state)); await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('comparison timed out');
  };
  try {
    await t.test('Credits PDF is served with verified source bytes and attachment headers', async t => {
      const manifest = parse(fs.readFileSync(path.join(root, 'data/node-runtime/runtime_manifest.json'), 'utf8'));
      const source = manifest.source_files.find(row => row.path === 'web/public/downloads/PlanetX_Data_Spec.pdf');
      if (!source) { t.skip('historical bundle predates the public PDF'); return; }
      assert.equal(source.runtime_required, true);
      const response = await fetch(base + '/downloads/PlanetX_Data_Spec.pdf');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="PlanetX_Data_Spec.pdf"');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, source.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      const head = await fetch(base + '/downloads/PlanetX_Data_Spec.pdf', { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
      assert.equal((await fetch(base + '/downloads/undeclared.pdf')).status, 404);
    });
    await t.test('health and current getter/filter contracts use the actual exported data', async () => {
      assert.equal((await request('/health/ready')).status, 200);
      await assert.rejects(start({ root, stateDir: state, port: 0, host: '127.0.0.1', noSignals: true }));
      assert.equal((await request(api + 'runtime')).value.runtime, 'node');
      assert.equal((await request(api + 'runtime')).value.public_scope, 'solar_system_1000au');
      for (const route of ['catalog/galaxies', 'catalog/galaxy-atlas', 'catalog/exoplanets', 'catalog/exoplanet-observations', 'catalog/extragalactic-planets', 'catalog/universe', 'catalog/comets', 'cosmic-history', 'cosmic-observations', 'black-holes', 'observer-physics', 'physics/numerical-relativity']) {
        assert.equal((await request(api + route)).status, 410, route);
        assert.equal((await request(api + route, {})).status, 410, route);
      }
      assert.equal((await request(api + 'catalog/solar-system')).value.objects.length, 476);
      const unlinked = await request(api + 'observations?object_id=moon-301');
      assert.equal(unlinked.value.status, 'no_linked_observations'); assert.deepEqual(unlinked.value.observations, []);
      assert.equal((await request(api + 'observations?object_id=unknown-body')).status, 404);
      const regions = (await request(api + 'planet-nine/regions?limit=2')).value;
      assert.equal(regions.selection.selected_count, 20406); assert.equal(regions.rows.length, 2);
      assert.ok(regions.rows[0].count >= regions.rows[1].count);
      const members = (await request(api + 'planet-nine/regions/' + regions.rows[0].cell_id + '/members?limit=1')).value;
      const member = (await request(api + 'planet-nine/population/' + members.rows[0])).value;
      assert.equal(member.cell_id, regions.rows[0].cell_id); assert.equal(member.source_sha256.length, 64);
      assert.equal((await request(api + 'planet-nine/regions?limit=101')).status, 422);
      assert.equal((await request(api + 'planet-nine/population/100000')).status, 422);
      const outer = (await request(api + 'catalog/outer-tno')).value;
      assert.equal(outer.objects.length, 8341);
      const scene = (await request(api + 'catalog/outer-tno/scene')).value;
      assert.equal(scene.catalogue_count, 8341); assert.equal(scene.unavailable_count, 1);
      assert.equal((await request(api + 'observations?object_id=' + outer.objects[0].object_id)).value.status, 'no_linked_observations');
      assert.equal((await request(api + 'planet-criteria?object_id=sedna')).value.object_filter, 'sedna');
      assert.equal((await request(api + 'planet-criteria?object_id=__proto__')).status, 422);
      assert.equal((await request(api + 'catalog/exoplanets/constructor')).status, 410);
      assert.equal((await request(api + 'long-term-simulation?year=0&month=2&day=29')).value.calendar_date.year, 0);
      assert.equal((await request(api + 'universe?epoch=2026-11-13T24:00:00Z')).status, 422);
      assert.equal((await request(api + 'long-term-simulation?year=2026&month=2&day=30')).status, 422);
      assert.equal((await request(api + 'catalog/solar-system?parent_id=../x')).status, 422);
    });
    await t.test('exported Solar catalogues retain the independently hashed source and display algorithm metadata', async () => {
      const sourceBytes = fs.readFileSync(path.join(root, 'data/manifests/extended_solar.json'));
      const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
      for (const suffix of ['', '?parent_id=earth', '?parent_id=sedna']) {
        const response = await request(api + 'catalog/solar-system' + suffix);
        assert.equal(response.status, 200, suffix + ': ' + response.text);
        assert.equal(response.value.source_manifest_sha256, sourceSha256, suffix + ': source manifest SHA');
        assert.equal(response.value.display_algorithm_version, 'extended-solar-parent-hermite-v1', suffix + ': display algorithm');
      }
    });
    await t.test('Solar targets expose exact registered sources and allowed pairs, or a normal empty observation state', async () => {
      const manifest = parse(fs.readFileSync(path.join(root, 'data/node-runtime/runtime_manifest.json'), 'utf8'));
      let registry = null;
      if (manifest.observation_registry) {
        assert.equal(manifest.observation_registry.path, 'data/manifests/observation_registry.json');
        const registryBytes = fs.readFileSync(path.join(root, manifest.observation_registry.path));
        assert.equal(createHash('sha256').update(registryBytes).digest('hex'), manifest.observation_registry.sha256);
        registry = parse(registryBytes.toString('utf8'));
      }
      const assertRegistered = (id, value) => {
        const entries = Object.values(registry.exposures).filter(entry => entry.object_id === id && entry.enabled);
        const expectedIds = entries.map(entry => entry.observation_id).sort();
        const expectedPairs = registry.pairs.filter(ids => ids.every(key => registry.exposures[key].object_id === id));
        assert.equal(value.status, 'available', id);
        assert.deepEqual(value.default_pair, registry.objects[id].default_pair, id + ': default pair');
        assert.deepEqual(value.observations.map(observation => observation.observation_id).sort(), expectedIds, id + ': source IDs');
        assert.deepEqual(value.available_pairs.map(ids => ids.join(',')).sort(), expectedPairs.map(ids => ids.join(',')).sort(), id + ': allowed pairs');
        for (const observation of value.observations) {
          const entry = registry.exposures[observation.observation_id];
          assert.equal(observation.sha256, entry.source.sha256, entry.source_id + ': source SHA');
          assert.equal(observation.bytes, entry.source.bytes, entry.source_id + ': source bytes');
        }
        assert.deepEqual(Object.entries(manifest.comparisons).filter(([, entry]) => entry.object_id === id).map(([key]) => key).sort(),
          expectedPairs.flatMap(ids => [ids.join(','), [...ids].reverse().join(',')]).sort(), id + ': ordered cache pairs');
      };
      for (const id of ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
        const response = await request(api + 'observations?object_id=' + id);
        assert.equal(response.status, 200, id + ': ' + response.text);
        assert.equal(response.value.object_id, id); assert.equal(response.value.next_cursor, null);
        if (registry && Object.hasOwn(registry.objects, id)) assertRegistered(id, response.value);
        else {
          assert.equal(response.value.status, 'no_linked_observations');
          assert.deepEqual(response.value.observations, []);
        }
      }
      const pluto = await request(api + 'observations?object_id=pluto');
      assert.equal(pluto.status, 200); assert.equal(pluto.value.status, 'available');
      if (registry) assertRegistered('pluto', pluto.value);
      else {
        const expectedIds = ['S12', 'S14'], expectedPairs = [['S12', 'S14']];
        assert.deepEqual(pluto.value.available_pairs ?? expectedPairs, expectedPairs);
        assert.deepEqual(pluto.value.observations.map(observation => observation.observation_id).sort(), expectedIds);
        assert.deepEqual(Object.entries(manifest.comparisons).filter(([, entry]) => entry.object_id === 'pluto').map(([key]) => key).sort(),
          expectedPairs.flatMap(ids => [ids.join(','), [...ids].reverse().join(',')]).sort());
      }
    });
    let evidence, rawEvidence, legacyEvidence;
    await t.test('both actual observation pairs and reversed ordering preserve source dates and result ids', async () => {
      const manifest = parse(fs.readFileSync(path.join(root, 'data/node-runtime/runtime_manifest.json'), 'utf8'));
      for (const ids of [['S01', 'S02'], ['S02', 'S01'], ['S12', 'S14'], ['S14', 'S12']]) {
        const job = await complete(ids); assert.equal(job.result_id, manifest.comparisons[ids.join(',')].result_id);
        const response = await request(api + 'comparisons/' + job.result_id + '/manifest');
        assert.deepEqual(response.value.frames.map(f => f.observation_id), ids);
        assert.equal(response.value.scientific_status, 'association_insufficient');
        assert.equal(response.value.frames[0].metadata.pipeline_version, '7.0.5');
        assert.equal(response.value.frames[0].metadata.date_avg, read('observations_' + job.object_id).observations.find(f => f.observation_id === ids[0]).date_avg);
      }
    });
    await t.test('Solar mass, camera, judgment and exact comparison floats survive export/import', async () => {
      const source = read('universe'), timeline = read('timeline'), mass = read('mass_scenarios'), model = read('long_term_model');
      const comparison = JSON.parse(fs.readFileSync(path.join(root, 'data/node-runtime/comparisons/S01_S02.json'), 'utf8'));
      const context = { selected_object_id: 'epsilon-indi-b', model_epoch: timeline.default_epoch, source_manifest_sha256: source.source_manifest_sha256, orbit_manifest_sha256: source.orbit_manifest_sha256, timeline_algorithm_version: 'display-hermite-v1', playback_paused: true, camera: { position: [120, 80, 100], target: [0, 0, 0], representation_version: 'solar-display-v1' }, time_preference: 'auto', simulation_context: { algorithm_version: model.algorithm_version, source_manifest_sha256: model.source_manifest_sha256, model_calendar_ms: Date.UTC(2500, 0, 1), playback_paused: true },
        mass_scenarios_manifest_sha256: mass.source_manifest_sha256, mass_scenario: { target_id: 'sedna', density_kg_m3: 1000, analogue_id: null, include_source_ranges: true } };
      const saved = await request(api + 'evidence', { result_id: comparison.result_id, session: { object_id: 'epsilon-indi-b', observation_ids: ['S01', 'S02'], universe_context: context }, judgment: '원본 날짜와 판단 보존 =1+1' });
      assert.equal(saved.status, 201, saved.text); evidence = saved.value;
      const exported = await request(api + 'evidence/' + evidence.evidence_id + '/export'); rawEvidence = exported.text;
      const originalComparison = fs.readFileSync(path.join(root, 'data/node-runtime/comparisons/S01_S02.json'), 'utf8');
      assert.ok(rawEvidence.includes('"comparison":' + originalComparison));
      assert.equal(hash(originalComparison), evidence.comparison_sha256);
      const restored = await request(api + 'evidence/import', evidence); assert.equal(restored.value.status, 'restored', restored.text);
      assert.equal(restored.value.judgment, evidence.judgment); assert.equal(restored.value.session.universe_context.mass_scenario.target_id, 'sedna');
      assert.equal(restored.value.comparison.frames[0].quality.pixel_count, 29);
      legacyEvidence = structuredClone(evidence); legacyEvidence.evidence_id = 'ev_' + require('node:crypto').randomUUID().replaceAll('-', '');
      Object.assign(legacyEvidence.session.universe_context, { show_galaxies: true, galaxy_manifest_sha256: 'f'.repeat(64), observer_physics_manifest_sha256: 'e'.repeat(64), observer_experiment: { radial_beta: .001, emitted_wavelength_nm: 600, local_observer_radius_rs: 7.5 }, observer_panel_open: true, black_holes_manifest_sha256: 'd'.repeat(64), selected_black_hole_id: 'bh-m87' });
      const partial = await request(api + 'evidence/import', legacyEvidence);
      assert.equal(partial.value.status, 'partially_restored', partial.text);
      assert.equal(partial.value.response_schema_version, '1.1'); assert.equal(partial.value.migration_policy, 'solar-scope-context-v1');
      assert.deepEqual(partial.value.omitted_contexts.map(v => v.feature).sort(), ['black_holes', 'galaxies', 'observer_physics']);
      assert.equal('show_galaxies' in partial.value.session.universe_context, false);
      assert.equal('observer_experiment' in partial.value.session.universe_context, false);
      assert.equal(partial.value.comparison.result_id, evidence.result_id);
      const oldExport = await request(api + 'evidence/' + legacyEvidence.evidence_id + '/export');
      assert.deepEqual(oldExport.value, legacyEvidence); assert.ok(oldExport.text.includes('"comparison":' + originalComparison));
      const tampered = structuredClone(evidence); tampered.comparison.frames[0].cutout.IMAGE[0][0] = 123456;
      assert.equal((await request(api + 'evidence/import', tampered)).status, 409);
      const changed = structuredClone(evidence); changed.session.universe_context.mass_scenarios_manifest_sha256 = 'a'.repeat(64);
      const blocked = await request(api + 'evidence/import', changed); assert.equal(blocked.value.status, 'recalculation_required'); assert.ok(blocked.value.reasons.includes('mass_scenario_sources_changed'));
    });
    await t.test('empty-body cancellation, finite strict input and request byte limit are enforced', async () => {
      assert.equal((await request(api + 'comparison-jobs', { observation_ids: ['S01', 'S12'] })).status, 422);
      assert.equal((await request(api + 'mass-scenarios/calculate', { target_id: 'sedna', density_kg_m3: '1000' })).status, 422);
      assert.equal((await request(api + 'evidence/import', '{"x":NaN}')).status, 422);
      assert.equal((await request(api + 'evidence/import', ' '.repeat(8_000_001))).status, 413);
      const created = await request(api + 'comparison-jobs', { observation_ids: ['S01', 'S02'] });
      const cancelled = await request(api + 'jobs/' + created.value.job_id + '/cancel', ''); assert.equal(cancelled.status, 200); assert.equal(cancelled.value.cancel_requested, true);
    });
    await runtime.close();
    const abandoned = { schema_version: '1.0', job_id: 'job_' + 'a'.repeat(32), observation_ids: ['S01', 'S02'], state: 'running', stage: 'validating_built_fits_cache', progress: .1 };
    atomic(path.join(state, 'jobs', abandoned.job_id + '.json'), abandoned);
    runtime = await start({ root, stateDir: state, port: 0, host: '127.0.0.1', noSignals: true }); base = 'http://127.0.0.1:' + runtime.server.address().port;
    await t.test('same evidence/result IDs restore after a real Node server and worker restart', async () => {
      const restored = await request(api + 'evidence/import', rawEvidence); assert.equal(restored.value.status, 'restored', restored.text);
      assert.equal(restored.value.evidence_id, evidence.evidence_id); assert.equal(restored.value.comparison.result_id, evidence.result_id);
      assert.equal(restored.value.session.universe_context.camera.position[0], 120);
      const interrupted = await request(api + 'jobs/' + abandoned.job_id); assert.equal(interrupted.value.state, 'interrupted'); assert.equal(interrupted.value.stage, 'restart');
    });
    await runtime.close();
    const freshState = fs.mkdtempSync(path.join(root, 'tmp', 'node-fresh-import-'));
    runtime = await start({ root, stateDir: freshState, port: 0, host: '127.0.0.1', noSignals: true }); base = 'http://127.0.0.1:' + runtime.server.address().port;
    await t.test('old evidence restores its core into empty state and preserves the original envelope', async () => {
      const partial = await request(api + 'evidence/import', legacyEvidence);
      assert.equal(partial.value.status, 'partially_restored', partial.text);
      assert.equal(partial.value.comparison.result_id, legacyEvidence.result_id);
      assert.deepEqual((await request(api + 'evidence/' + legacyEvidence.evidence_id + '/export')).value, legacyEvidence);
      assert.equal((await request(api + 'comparisons/' + legacyEvidence.result_id + '/manifest')).status, 200);
      const collision = structuredClone(legacyEvidence); collision.judgment += ' collision';
      assert.equal((await request(api + 'evidence/import', collision)).status, 409);
    });
  } finally { await runtime.close(); }
});

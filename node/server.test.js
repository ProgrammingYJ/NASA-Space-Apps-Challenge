'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
    await t.test('health and current getter/filter contracts use the actual exported data', async () => {
      assert.equal((await request('/health/ready')).status, 200);
      await assert.rejects(start({ root, stateDir: state, port: 0, host: '127.0.0.1', noSignals: true }));
      assert.equal((await request(api + 'runtime')).value.runtime, 'node');
      assert.equal((await request(api + 'catalog/exoplanets')).value.planet_count, 6470);
      assert.equal((await request(api + 'catalog/solar-system')).value.objects.length, 476);
      const comets = (await request(api + 'catalog/comets')).value;
      assert.equal(comets.algorithm_version, 'historical-comets-v1');
      assert.equal(comets.objects.length, 4);
      assert.equal(comets.objects.reduce((n, comet) => n + comet.knots.length, 0), 489);
      const atlas = await request(api + 'catalog/galaxy-atlas?query=Messier%2031&limit=1');
      assert.equal(atlas.status, 200); assert.equal(atlas.value.record_count, 53162); assert.equal(atlas.value.matched_count, 1);
      assert.equal(atlas.value.objects[0].existing_object_id, 'galaxy-m31');
      assert.ok((await request(api + 'catalog/galaxy-atlas?query=NGC224')).value.objects.some(row=>row.existing_object_id==='galaxy-m31'));
      const atlasMarkers = (await request(api + 'catalog/galaxy-atlas/markers')).value;
      assert.equal(atlasMarkers.marker_count, 53162); assert.equal(atlasMarkers.columns.object_id.length, 53162);
      assert.equal((await request(api + 'catalog/galaxy-atlas/gwgc-pgc-2')).value.name, 'UGC12889');
      assert.equal((await request(api + 'catalog/galaxy-atlas?query=%EC%9D%80%ED%95%98')).value.matched_count, 0);
      assert.equal((await request(api + 'catalog/galaxy-atlas?limit=201')).status, 422);
      const nr = (await request(api + 'physics/numerical-relativity')).value;
      assert.equal(nr.algorithm_version, 'sxs-nrar-h22-native-replay-v1');
      assert.equal(nr.columns.time_over_m.length, 13869);
      assert.ok(comets.objects.every(comet => comet.time_scale === 'TDB' && comet.center === 'Sun'));
      assert.equal(Object.keys((await request(api + 'black-holes')).value.objects).length, 11);
      assert.equal((await request(api + 'catalog/universe?galaxy_id=galaxy-milky-way')).value.objects.length, 4871);
      const hosts = read('universe_host_children'), host = Object.keys(hosts).find(k => hosts[k].length === 7);
      assert.deepEqual((await request(api + 'catalog/universe?parent_id=' + host)).value.objects, hosts[host]);
      assert.equal((await request(api + 'catalog/extragalactic-planets?galaxy_id=galaxy-m31')).value.confirmed_objects.length, 0);
      assert.equal((await request(api + 'planet-criteria?object_id=sedna')).value.object_filter, 'sedna');
      assert.equal((await request(api + 'planet-criteria?object_id=__proto__')).status, 422);
      assert.equal((await request(api + 'catalog/exoplanets/constructor')).status, 404);
      const photos = await request(api + 'catalog/exoplanet-observations?object_id=' + read('exoplanet_observations').observations[0].object_id); assert.equal(photos.value.observations.length, 1);
      assert.equal((await request(api + 'long-term-simulation?year=0&month=2&day=29')).value.calendar_date.year, 0);
      assert.equal((await request(api + 'universe?epoch=2026-11-13T24:00:00Z')).status, 422);
      assert.equal((await request(api + 'long-term-simulation?year=2026&month=2&day=30')).status, 422);
      assert.equal((await request(api + 'catalog/universe?galaxy_id=galaxy-m31&parent_id=' + host)).status, 422);
      assert.equal((await request(api + 'catalog/solar-system?parent_id=../x')).status, 422);
    });
    let evidence, rawEvidence;
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
    await t.test('new mass/observer/black-hole context, judgment and exact comparison floats survive export/import', async () => {
      const source = read('universe'), timeline = read('timeline'), mass = read('mass_scenarios'), model = read('long_term_model');
      const comparison = JSON.parse(fs.readFileSync(path.join(root, 'data/node-runtime/comparisons/S01_S02.json'), 'utf8'));
      const context = { selected_object_id: 'epsilon-indi-b', model_epoch: timeline.default_epoch, source_manifest_sha256: source.source_manifest_sha256, orbit_manifest_sha256: source.orbit_manifest_sha256, timeline_algorithm_version: 'display-hermite-v1', playback_paused: true, camera: { position: [120, 80, 100], target: [0, 0, 0], representation_version: 'solar-display-v1' }, time_preference: 'auto', simulation_context: { algorithm_version: model.algorithm_version, source_manifest_sha256: model.source_manifest_sha256, model_calendar_ms: Date.UTC(2500, 0, 1), playback_paused: true },
        mass_scenarios_manifest_sha256: mass.source_manifest_sha256, mass_scenario: { target_id: 'sedna', density_kg_m3: 1000, analogue_id: null, include_source_ranges: true }, observer_physics_manifest_sha256: read('observer_physics').source_manifest_sha256, black_holes_manifest_sha256: read('black_holes').source_manifest_sha256, observer_experiment: { radial_beta: .001, emitted_wavelength_nm: 600, local_observer_radius_rs: 7.5 }, selected_black_hole_id: 'bh-m87', observer_panel_open: true };
      // Use the source-selected key rather than introducing a different identity.
      context.selected_black_hole_id = Object.keys(read('black_holes').objects).find(id => /m87/i.test(id));
      const saved = await request(api + 'evidence', { result_id: comparison.result_id, session: { object_id: 'epsilon-indi-b', observation_ids: ['S01', 'S02'], universe_context: context }, judgment: '원본 날짜와 판단 보존 =1+1' });
      assert.equal(saved.status, 201, saved.text); evidence = saved.value;
      const exported = await request(api + 'evidence/' + evidence.evidence_id + '/export'); rawEvidence = exported.text;
      const originalComparison = fs.readFileSync(path.join(root, 'data/node-runtime/comparisons/S01_S02.json'), 'utf8');
      assert.ok(rawEvidence.includes('"comparison":' + originalComparison));
      assert.equal(hash(originalComparison), evidence.comparison_sha256);
      const restored = await request(api + 'evidence/import', evidence); assert.equal(restored.value.status, 'restored', restored.text);
      assert.equal(restored.value.judgment, evidence.judgment); assert.equal(restored.value.session.universe_context.mass_scenario.target_id, 'sedna');
      assert.equal(restored.value.comparison.frames[0].quality.pixel_count, 29);
      const invalidSelection = structuredClone(evidence);
      invalidSelection.session.universe_context.selected_black_hole_id = 'constructor';
      const selectionBlocked = await request(api + 'evidence/import', invalidSelection);
      assert.equal(selectionBlocked.value.status, 'recalculation_required');
      assert.ok(selectionBlocked.value.reasons.includes('unsupported_black_hole_selection'));
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
      assert.equal(restored.value.session.universe_context.observer_experiment.local_observer_radius_rs, 7.5);
      assert.equal(restored.value.session.universe_context.camera.position[0], 120);
      const interrupted = await request(api + 'jobs/' + abandoned.job_id); assert.equal(interrupted.value.state, 'interrupted'); assert.equal(interrupted.value.stage, 'restart');
    });
  } finally { await runtime.close(); }
});

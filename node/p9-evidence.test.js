'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evidenceStore } = require('./p9-evidence');
const { canonical, hash } = require('./storage');
const orbit = { a_au: 500, e: .2, i_deg: 15, omega_deg: 200, Omega_deg: 40, M_deg: 10, epoch_jd_tdb: 2458270, mass_earth: 5 };
const normalizeOrbit = value => structuredClone(value);
const request = { orbit, start_jd_tdb: 2460000, end_jd_tdb: 2460001, samples: 2, observer: 'sun' };
const predict = async value => ({ algorithm_version: 'test-model-1', request: value, result: [1, 2] });
const coverage = { verify: value => value, verifyForSave: value => value };
const presets = async () => ({ source: { sha256: 'a'.repeat(64) }, presets: [{ id: 'caltech-row-0', row_index: 0, orbit }] });
test('coverage binds calendar labels while gravity binds the exact model start epoch', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-date-test-'));
  const gravity = async (_kind, request) => ({ request });
  const store = evidenceStore({ stateDir, normalizeOrbit, predict, presets, coverage, gravity });
  // A fractional TDB-assumed model day shares a selected calendar date with
  // the full UTC archive search day. This is deliberately not epoch equality.
  const dates = { ...request, start_jd_tdb: 2461313, end_jd_tdb: 2461316.25 };
  const query = require('./p9-coverage').makeQuery({ orbit, start_date: '2026-09-29', end_date: '2026-10-02' }, normalizeOrbit);
  const input = { orbit, prediction: await predict(dates), coverage: { query }, gravity: { kind: 'field', result: { request: { jd_tdb: dates.start_jd_tdb } } }, judgment: 'Date selection only, not UTC/TDB conversion.', locale: 'en' };
  const saved = await store.save(input), original = store.raw(saved.evidence_id);
  assert.equal((await store.restore(saved)).status, 'restored');
  for (const key of ['obs_begin', 'obs_end']) {
    const mismatch = structuredClone(input); mismatch.coverage.query[key] = key === 'obs_begin' ? '2026 09 30 00:00:00' : '2026 10 03 23:59:59';
    await assert.rejects(store.save(mismatch), /coverage_date_selection_mismatch/);
    const imported = structuredClone(saved); imported.payload.coverage = mismatch.coverage; imported.payload_sha256 = hash(canonical(imported.payload));
    await assert.rejects(store.restore(imported), /coverage_date_selection_mismatch/);
  }
  for (const kind of ['field', 'integration']) {
    const mismatch = structuredClone(input); mismatch.gravity = { kind, result: { request: kind === 'field' ? { jd_tdb: dates.start_jd_tdb + 1 } : { orbit, start_jd_tdb: dates.start_jd_tdb + 1 } } };
    await assert.rejects(store.save(mismatch), /gravity_date_selection_mismatch/);
    const imported = structuredClone(saved); imported.payload.gravity = mismatch.gravity; imported.payload_sha256 = hash(canonical(imported.payload));
    await assert.rejects(store.restore(imported), /gravity_date_selection_mismatch/);
  }
  assert.equal(store.raw(saved.evidence_id), original);
});
test('P9 evidence independently saves, exports and restores without observational comparison ID', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-evidence-test-')), store = evidenceStore({ stateDir, normalizeOrbit, predict, presets, coverage });
  const saved = await store.save({ orbit, prediction: await predict(request), coverage: null, judgment: '관측 범위 가설, 검출 아님', locale: 'ko', source: { preset_id: 'caltech-row-0', row_index: 0, source_sha256: 'a'.repeat(64) } });
  assert.match(saved.evidence_id, /^p9ev_[a-f0-9]{32}$/); assert.equal(saved.payload_sha256, hash(canonical(saved.payload)));
  const exact = store.raw(saved.evidence_id); assert.deepEqual(JSON.parse(exact), saved);
  const fresh = evidenceStore({ stateDir: fs.mkdtempSync(path.join(os.tmpdir(), 'p9-fresh-test-')), normalizeOrbit, predict, presets, coverage });
  const restored = await fresh.restore(JSON.parse(exact));
  assert.equal(restored.status, 'restored'); assert.equal(restored.evidence.evidence_id, saved.evidence_id); assert.equal(restored.evidence.payload.judgment, saved.payload.judgment);
  assert.equal('result_id' in saved, false);
  assert.equal(fresh.raw(saved.evidence_id), exact);
  const tampered = structuredClone(saved); tampered.payload.orbit.a_au = 600; await assert.rejects(store.restore(tampered), /integrity/);
  await assert.rejects(store.save({ ...saved.payload, prediction: { ...saved.payload.prediction, result: [8, 9] } }), /prediction_integrity/);
  await assert.rejects(store.save({ ...saved.payload, source: { preset_id: 'caltech-row-1', row_index: 1, source_sha256: 'a'.repeat(64) } }), /hypothesis_source_changed/);
  const changed = evidenceStore({ stateDir, normalizeOrbit, predict: async value => ({ algorithm_version: 'test-model-2', request: value }), presets, coverage });
  const old = await changed.restore(saved); assert.equal(old.status, 'recalculation_required'); assert.ok(old.reasons.includes('prediction_model_changed')); assert.deepEqual(old.evidence, saved);
});

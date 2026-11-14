'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { lock, atomic, parse, safePath } = require('./storage');
const { validator, sessionRules } = require('./schema');
test('single writer rejects a second owner and atomically preserves strict JSON', () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'spherex-node-lock-'));
  const release = lock(state);
  try { assert.throws(() => lock(state)); const file = path.join(state, 'evidence.json'); atomic(file, { judgment: '원자료', n: null }); assert.deepEqual(parse(fs.readFileSync(file, 'utf8')), { judgment: '원자료', n: null }); assert.throws(() => atomic(file, { n: NaN })); assert.equal(parse(fs.readFileSync(file, 'utf8')).n, null); assert.throws(() => safePath(state, '../evidence.json')); }
  finally { release(); }
  lock(state)();
});
test('current OpenAPI rejects unknown fields and invalid observer/session ranges', () => {
  const validate = validator(parse(fs.readFileSync(path.join(__dirname, '..', 'contracts/openapi.json'), 'utf8')));
  const session = { object_id: 'epsilon-indi-b', observation_ids: ['S01', 'S02'] };
  assert.equal(sessionRules(validate('Session', session)).contrast, 1);
  assert.throws(() => validate('Session', { ...session, unknown: 1 }));
  assert.throws(() => sessionRules(validate('Session', { ...session, observation_ids: ['S12', 'S14'] })));
  assert.throws(() => validate('ObserverExperiment', { radial_beta: 1 }));
  assert.throws(() => validate('ObserverExperiment', { radial_beta: '0.5' }));
  const c = { selected_object_id: 'epsilon-indi-b', model_epoch: '2026-11-14T00:00:00Z', source_manifest_sha256: 'a'.repeat(64), observer_experiment: {} };
  assert.throws(() => sessionRules(validate('Session', { ...session, universe_context: c })));
});

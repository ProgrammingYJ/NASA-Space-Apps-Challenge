'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Sources } = require('./sources');
const { hash, canonical } = require('./storage');
test('worker rejects missing/corrupt sources and cache bytes; only the declared serving replica substitutes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spherex-source-boundary-'));
  const bundle = path.join(root, 'data/node-runtime'); fs.mkdirSync(bundle, { recursive: true });
  const snapshot = '{"fixture":"source integrity test only"}', actual = Buffer.from('independent source bytes');
  fs.writeFileSync(path.join(bundle, 'test.json'), snapshot); fs.mkdirSync(path.join(root, 'web/dist'), { recursive: true }); fs.writeFileSync(path.join(root, 'web/dist', 'image.jpg'), actual);
  const manifest = { schema_version: '1.0', algorithm_version: 'python-built-node-snapshot-v1', files: [{ path: 'test.json', sha256: hash(snapshot), bytes: Buffer.byteLength(snapshot) }], source_files: [{ path: 'web/public/image.jpg', serving_copy_path: 'web/dist/image.jpg', sha256: hash(actual), bytes: actual.length, runtime_required: true }], snapshots: { test: 'test.json' }, comparisons: {} };
  fs.writeFileSync(path.join(bundle, 'runtime_manifest.json'), canonical(manifest));
  const sources = new Sources(root);
  try {
    assert.deepEqual(await sources.call('snapshot', 'test'), JSON.parse(snapshot));
    const before = await sources.call('diagnostics');
    await Promise.all(Array.from({ length: 5 }, () => sources.call('snapshot', 'test')));
    const after = await sources.call('diagnostics');
    assert.equal(after.hash_reads, before.hash_reads, 'unchanged identities reuse only a previously verified SHA');
    assert.equal(after.validation_passes - before.validation_passes, 2, 'five concurrently queued reads share one pass plus this diagnostic pass');
    assert.equal(after.verification_policy.version, 'sha256-stat-fingerprint-v2-scoped-assets');
    const savedTimes = fs.statSync(path.join(root, 'web/dist/image.jpg'));
    fs.writeFileSync(path.join(root, 'web/dist/image.jpg'), Buffer.alloc(actual.length, 97));
    fs.utimesSync(path.join(root, 'web/dist/image.jpg'), savedTimes.atime, savedTimes.mtime);
    await assert.rejects(sources.call('verify'), 'same size and restored mtime cannot bypass ctime/identity revalidation');
    fs.writeFileSync(path.join(root, 'web/dist/image.jpg'), actual);
    assert.deepEqual(await sources.call('verify'), { ready: true });
    const beforeAudit = await sources.call('diagnostics');
    assert.deepEqual(await sources.call('verify', null, true), { ready: true });
    const afterAudit = await sources.call('diagnostics');
    assert.ok(afterAudit.hash_reads > beforeAudit.hash_reads, 'explicit full audit rereads unchanged bytes');
    fs.unlinkSync(path.join(root, 'web/dist/image.jpg')); await assert.rejects(sources.call('verify'));
    fs.writeFileSync(path.join(root, 'web/dist/image.jpg'), actual);
    fs.writeFileSync(path.join(bundle, 'test.json'), '{"fixture":"changed"}'); await assert.rejects(sources.call('snapshot', 'test'));
  } finally { await sources.close(); }
});

test('static assets validate their own registered bytes without claiming unrelated science is ready', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spherex-asset-boundary-'));
  const bundle = path.join(root, 'data/node-runtime'); fs.mkdirSync(bundle, { recursive: true });
  fs.mkdirSync(path.join(root, 'web/dist/textures'), { recursive: true }); fs.mkdirSync(path.join(root, 'data/raw'), { recursive: true });
  const asset = Buffer.from('source texture pixels'), science = Buffer.from('immutable science input');
  const assetPath = path.join(root, 'web/dist/textures/test.png'), sciencePath = path.join(root, 'data/raw/input.bin');
  fs.writeFileSync(assetPath, asset); fs.writeFileSync(sciencePath, science);
  const manifest = { schema_version: '1.0', algorithm_version: 'python-built-node-snapshot-v1', files: [], source_files: [
    { path: 'web/public/textures/test.png', serving_copy_path: 'web/dist/textures/test.png', sha256: hash(asset), bytes: asset.length, runtime_required: true },
    { path: 'data/raw/input.bin', sha256: hash(science), bytes: science.length, runtime_required: true }
  ], snapshots: {}, comparisons: {} };
  fs.writeFileSync(path.join(bundle, 'runtime_manifest.json'), canonical(manifest));
  const sources = new Sources(root);
  try {
    assert.equal((await sources.call('asset', 'textures/test.png')).ready, true, 'first asset still requires the initial complete audit');
    fs.writeFileSync(sciencePath, Buffer.alloc(science.length, 99));
    await assert.rejects(sources.call('verify')); assert.equal(sources.ready, false);
    assert.equal((await sources.call('asset', 'textures/test.png')).verification_scope, 'requested_manifest_asset_only');
    assert.equal(sources.ready, false, 'valid texture cannot override the failed science audit');
    await assert.rejects(sources.call('asset', 'textures/unknown.png')); await assert.rejects(sources.call('asset', '../data/raw/input.bin'));
    fs.writeFileSync(assetPath, Buffer.alloc(asset.length, 99)); await assert.rejects(sources.call('asset', 'textures/test.png'));
    fs.writeFileSync(assetPath, asset); fs.writeFileSync(sciencePath, science); await sources.call('verify');
    assert.equal(sources.ready, true);
    fs.writeFileSync(path.join(bundle, 'runtime_manifest.json'), canonical({ ...manifest, changed: true }));
    await assert.rejects(sources.call('asset', 'textures/test.png'), 'changed manifest still requires a restart');
  } finally { await sources.close(); }
});

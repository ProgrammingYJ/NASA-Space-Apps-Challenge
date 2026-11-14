'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { hash, parse, safePath } = require('./storage');
const { SOURCE_VERIFICATION_POLICY } = require('./verification-policy');
const root = workerData.root, bundle = path.join(root, 'data', 'node-runtime');
let manifest, manifestHash, initialized = false, failure = null;
const metadata = new Map(), payloads = new Map();
const stats = { validation_passes: 0, hash_reads: 0, hash_bytes: 0, payload_hash_checks: 0, completed_transactions: 0 };
const fingerprint = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(stat[key])).join(':');
function validate(file, base, strong = false) {
  if (!file || !Number.isSafeInteger(file.bytes) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('invalid_runtime_manifest');
  const absolute = safePath(base, file.path), stat = fs.statSync(absolute, { bigint: true }), stamp = fingerprint(stat), previous = metadata.get(absolute);
  if (!stat.isFile() || stat.size !== BigInt(file.bytes)) throw new Error('runtime_source_integrity');
  if (strong || previous?.fingerprint !== stamp || previous?.sha256 !== file.sha256) {
    const digest = require('node:crypto').createHash('sha256'), fd = fs.openSync(absolute, 'r'), buffer = Buffer.allocUnsafe(1024 * 1024);
    stats.hash_reads++; stats.hash_bytes += file.bytes;
    try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, count)); } finally { fs.closeSync(fd); }
    if (digest.digest('hex') !== file.sha256) throw new Error('runtime_source_integrity');
    if (fingerprint(fs.statSync(absolute, { bigint: true })) !== stamp || safePath(base, file.path) !== absolute) throw new Error('runtime_source_changed_during_verification');
    metadata.set(absolute, { fingerprint: stamp, sha256: file.sha256 }); payloads.delete(absolute);
  }
  return absolute;
}
function verifyManifestIdentity() {
  const rawManifest = fs.readFileSync(path.join(bundle, 'runtime_manifest.json'));
  const currentHash = hash(rawManifest);
  if (!manifest) { manifest = parse(rawManifest.toString('utf8')); manifestHash = currentHash; }
  else if (manifestHash !== currentHash) throw new Error('runtime_manifest_changed_restart_required');
  if (manifest.schema_version !== '1.0' || manifest.algorithm_version !== 'python-built-node-snapshot-v1') throw new Error('unsupported_runtime_manifest');
}
function verify(strong = false) {
  stats.validation_passes++;
  verifyManifestIdentity();
  try { for (const file of manifest.files) validate(file, bundle, strong); }
  catch (error) { error.validationScope = 'bundle'; throw error; }
  try {
    for (const file of manifest.source_files) if (file.runtime_required) {
      let source = file;
      if (file.serving_copy_path && !fs.existsSync(path.join(root, file.path))) source = { ...file, path: file.serving_copy_path };
      validate(source, root, strong);
      if (file.serving_copy_path && fs.existsSync(path.join(root, file.serving_copy_path))) validate({ ...file, path: file.serving_copy_path }, root, strong);
    }
  } catch (error) { error.validationScope = 'source'; throw error; }
  initialized = true;
}
function verifyAsset(relative, strong = false) {
  if (typeof relative !== 'string' || !/^(?:textures|brand)\//.test(relative)) throw new Error('invalid_asset_key');
  const target = 'web/dist/' + relative;
  const source = manifest.source_files.find(file => file.runtime_required && (file.path === 'web/public/' + relative || file.serving_copy_path === target));
  if (!source) throw new Error('asset_not_in_source_manifest');
  validate({ ...source, path: target }, root, strong);
  return { ready: true, verification_scope: 'requested_manifest_asset_only' };
}
function load(relative, raw = false) {
  const file = manifest.files.find(f => f.path === relative);
  const absolute = validate(file, bundle);
  if (raw || !payloads.has(absolute)) {
    const content = fs.readFileSync(absolute);
    stats.payload_hash_checks++;
    if (content.length !== file.bytes || hash(content) !== file.sha256) throw new Error('runtime_source_integrity');
    if (raw) return content.toString('utf8');
    payloads.set(absolute, parse(content.toString('utf8')));
  }
  return payloads.get(absolute);
}
const queued = [];
let scheduled = false;
function snapshot(key) { const entry = manifest.snapshots[key]; return load(typeof entry === 'string' ? entry : entry?.path); }
function drain() {
  scheduled = false;
  const batch = queued.splice(0);
  // Each batch was already queued together; no clock/TTL can skip a later
  // transaction's path, symlink-boundary and nanosecond fingerprint checks.
  let verificationError = null;
  const fullValidation = !initialized || batch.some(message => message.action !== 'asset' || message.strong === true);
  try { if (fullValidation) { verify(batch.some(message => message.strong === true)); failure = null; } else verifyManifestIdentity(); }
  catch (error) { verificationError = error; failure = error.message; }
  for (const { id, action, key } of batch) {
    try {
      let sourceError = null;
      if (verificationError) {
        if (action !== 'importComparison' || verificationError.validationScope !== 'source') throw verificationError;
        sourceError = verificationError.code === 'ENOENT' ? 'source_missing' : 'source_integrity';
      }
      let value;
      if (action === 'asset') value = verifyAsset(key);
      else if (action === 'manifest') value = manifest;
      else if (action === 'snapshot') value = snapshot(key);
      else if (action === 'snapshots') {
        if (!Array.isArray(key) || key.some(item => typeof item !== 'string')) throw new Error('invalid_snapshot_keys');
        value = Object.fromEntries(key.map(item => [item, snapshot(item)]));
      } else if (action === 'comparison' || action === 'importComparison') {
        const entry = manifest.comparisons[key]; if (!entry) throw new Error('comparison_cache_unavailable');
        value = { ...entry, raw: load(entry.path, true), source_validation_error: sourceError };
      } else if (action === 'verify') value = { ready: true };
      else if (action === 'diagnostics') value = { ...stats, verification_policy: SOURCE_VERIFICATION_POLICY };
      else throw new Error('unknown_worker_action');
      stats.completed_transactions++;
      parentPort.postMessage({ id, value, ...(fullValidation ? { verification_ready: !verificationError } : {}) });
    } catch (error) { failure = error.message; parentPort.postMessage({ id, error: error.message }); }
  }
}
parentPort.on('message', message => {
  queued.push(...(Array.isArray(message.requests) ? message.requests : [message]));
  if (!scheduled) { scheduled = true; setImmediate(drain); }
});
setInterval(() => parentPort.postMessage({ heartbeat: Date.now(), initialized, failure }), 1000).unref();

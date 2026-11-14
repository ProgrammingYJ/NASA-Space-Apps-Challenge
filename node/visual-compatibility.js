'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const {parse, safePath} = require('./storage');

const MANIFEST = 'data/manifests/display_dependency_compatibility.json';
const ALGORITHM = 'visual-dependency-payload-equivalence-v1';
const CANONICAL = 'typed-json-ieee754be-v1';
const SHA = /^[a-f0-9]{64}$/;
const MAX_BYTES = 4_000_000;
const FIELDS = Object.freeze({
  small_body_appearance_manifest_sha256: 'data/manifests/small_body_appearance.json',
  mass_scenarios_manifest_sha256: 'data/manifests/mass_scenarios.json',
});
const DEPENDENCIES = Object.freeze({
  small_body_appearance_manifest_sha256: {
    'extended_solar.json': 'data/manifests/extended_solar.json',
    'appearance.json': 'data/manifests/appearance.json',
  },
  mass_scenarios_manifest_sha256: {
    planet_criteria: 'data/manifests/planet_criteria.json',
    small_body_appearance: 'data/manifests/small_body_appearance.json',
  },
});
const CHANGED_DEPENDENCY = Object.freeze({small_body_appearance_manifest_sha256: 'appearance.json', mass_scenarios_manifest_sha256: 'small_body_appearance'});
function fail(reason) {
  throw Object.assign(new Error('display_compatibility_integrity'), {code: 'display_compatibility_integrity', details: {reason}});
}
function requireValue(condition, reason) { if (!condition) fail(reason); }
function hash(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
function keys(value) { return Object.keys(value).sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))); }
function semantic(value) {
  if (value === null) return ['null'];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'string') return ['string', value];
  if (typeof value === 'number') {
    requireValue(Number.isFinite(value), 'nonfinite_payload');
    const raw = Buffer.alloc(8); raw.writeDoubleBE(value);
    return ['number', raw.toString('hex')];
  }
  if (Array.isArray(value)) return ['array', value.map(semantic)];
  requireValue(value && typeof value === 'object', 'unsupported_payload_value');
  return ['object', keys(value).map(key => [key, semantic(value[key])])];
}
function canonical(value) { return JSON.stringify(semantic(value)); }
function withoutDependencies(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && value.dependencies && typeof value.dependencies === 'object' && !Array.isArray(value.dependencies), 'missing_dependency_object');
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'dependencies'));
}
function payloadCanonicalSha256(value) { return hash(Buffer.from(canonical(withoutDependencies(value)), 'utf8')); }
function readRecord(root, record) {
  requireValue(record && typeof record.path === 'string' && SHA.test(record.sha256) && Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= MAX_BYTES, 'invalid_file_record');
  const file = safePath(root, record.path), stat = fs.statSync(file);
  requireValue(stat.isFile() && stat.size === record.bytes, 'file_size_mismatch');
  const raw = fs.readFileSync(file);
  requireValue(hash(raw) === record.sha256, 'file_hash_mismatch');
  return parse(raw.toString('utf8'));
}
function verifyDependencies(root, field, old, current) {
  const expected = DEPENDENCIES[field];
  requireValue(JSON.stringify(keys(old.dependencies)) === JSON.stringify(keys(expected)) && JSON.stringify(keys(current.dependencies)) === JSON.stringify(keys(expected)), 'dependency_set_changed');
  for (const [name, relative] of Object.entries(expected)) {
    const before = old.dependencies[name], after = current.dependencies[name];
    requireValue(before?.path === relative && after?.path === relative, 'dependency_identity_changed');
    const identity = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'bytes' && key !== 'sha256'));
    requireValue(canonical(identity(before)) === canonical(identity(after)), 'dependency_nonreference_payload_changed');
    if (name !== CHANGED_DEPENDENCY[field]) requireValue(canonical(before) === canonical(after), 'nonvisual_dependency_changed');
    readRecord(root, after);
  }
  requireValue(canonical(old.dependencies) !== canonical(current.dependencies), 'dependency_update_absent');
}
function verifiedMigrations(root) {
  const file = safePath(root, MANIFEST), stat = fs.statSync(file);
  requireValue(stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES, 'manifest_size');
  const manifest = parse(fs.readFileSync(file, 'utf8'));
  requireValue(manifest.schema_version === '1.0' && manifest.algorithm_version === ALGORITHM && manifest.canonical_algorithm === CANONICAL, 'manifest_version');
  requireValue(JSON.stringify(manifest.allowed_changed_top_level_fields) === '["dependencies"]' && Array.isArray(manifest.migrations) && manifest.migrations.length === Object.keys(FIELDS).length, 'migration_scope');
  const seen = new Set(), result = [];
  for (const record of manifest.migrations) {
    requireValue(record && Object.hasOwn(FIELDS, record.field) && !seen.has(record.field), 'migration_field'); seen.add(record.field);
    requireValue(SHA.test(record.from_sha256) && SHA.test(record.to_sha256) && record.from_sha256 !== record.to_sha256 && SHA.test(record.payload_canonical_sha256), 'migration_hashes');
    requireValue(record.original_path === FIELDS[record.field] && record.from?.path === `data/reference/visual-manifest-history/${record.from_sha256}.json` && record.from.sha256 === record.from_sha256 && record.to?.path === FIELDS[record.field] && record.to.sha256 === record.to_sha256, 'migration_paths');
    const evidence = record.source_evidence;
    requireValue(evidence && typeof evidence.archive === 'string' && !evidence.archive.includes('/') && !evidence.archive.includes('\\') && SHA.test(evidence.archive_sha256) && SHA.test(evidence.release_manifest_sha256) && evidence.archive_member_path === record.original_path && evidence.archive_member_sha256 === record.from_sha256, 'original_member_evidence');
    requireValue(JSON.stringify(record.changed_top_level_fields) === '["dependencies"]', 'changed_fields');
    const old = readRecord(root, record.from), current = readRecord(root, record.to);
    const oldPayload = canonical(withoutDependencies(old)), currentPayload = canonical(withoutDependencies(current));
    requireValue(oldPayload === currentPayload && hash(Buffer.from(oldPayload, 'utf8')) === record.payload_canonical_sha256, 'scientific_payload_changed');
    verifyDependencies(root, record.field, old, current);
    result.push({field: record.field, from_sha256: record.from_sha256, to_sha256: record.to_sha256});
  }
  return result;
}
function resolveDisplayCompatibility(root, field, fromSha256, toSha256) {
  if (!Object.hasOwn(FIELDS, field) || typeof fromSha256 !== 'string' || typeof toSha256 !== 'string' || !SHA.test(fromSha256) || !SHA.test(toSha256) || fromSha256 === toSha256) return null;
  return verifiedMigrations(root).find(record => record.field === field && record.from_sha256 === fromSha256 && record.to_sha256 === toSha256) ?? null;
}
module.exports = {resolveDisplayCompatibility, verifiedMigrations, payloadCanonicalSha256, semanticCanonical: canonical, constants: Object.freeze({MANIFEST, ALGORITHM, CANONICAL, FIELDS})};

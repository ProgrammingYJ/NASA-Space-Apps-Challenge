'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {resolveDisplayCompatibility, verifiedMigrations, payloadCanonicalSha256, semanticCanonical, constants} = require('./visual-compatibility');
const ROOT = path.resolve(__dirname, '..');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const temporary = path.join(ROOT, 'tmp'); fs.mkdirSync(temporary, {recursive: true});
  const root = fs.mkdtempSync(path.join(temporary, 'display-compatibility-test-'));
  function write(relative, value) {
    const raw = Buffer.isBuffer(value) ? value : encode(value), file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, raw);
    return {path: relative, bytes: raw.length, sha256: sha(raw)};
  }
  const appearance = write('data/manifests/appearance.json', {display: 'new observed RGB'});
  const extended = write('data/manifests/extended_solar.json', {physics: 'unchanged'});
  const criteria = write('data/manifests/planet_criteria.json', {mass: 'unchanged'});
  const smallPath = constants.FIELDS.small_body_appearance_manifest_sha256;
  const massPath = constants.FIELDS.mass_scenarios_manifest_sha256;
  const oldSmall = {created_utc: '2026-11-14T00:00:00Z', profiles: {sedna: {radius: 497.5, nested: {dependencies: {not_top_level: 'preserve me'}}}}, dependencies: {'extended_solar.json': extended, 'appearance.json': {path: appearance.path, bytes: 12, sha256: 'f'.repeat(64)}}};
  const oldSmallRaw = encode(oldSmall), oldSmallHash = sha(oldSmallRaw), small = clone(oldSmall);
  small.dependencies['appearance.json'] = appearance;
  const currentSmall = write(smallPath, small);
  const oldMass = {created_utc: '2026-11-14T00:00:00Z', model: {density: 984, coefficient: .001239, earth_mass: 5.97217e24}, targets: ['Sedna', 'Éris'], dependencies: {planet_criteria: criteria, small_body_appearance: {path: smallPath, bytes: oldSmallRaw.length, sha256: oldSmallHash}}};
  const oldMassRaw = encode(oldMass), mass = clone(oldMass); mass.dependencies.small_body_appearance = currentSmall;
  const currentMass = write(massPath, mass);
  const record = (field, oldRaw, current) => {
    const originalPath = constants.FIELDS[field], fromSha = sha(oldRaw);
    const from = write(`data/reference/visual-manifest-history/${fromSha}.json`, oldRaw);
    return {field, original_path: originalPath, from_sha256: fromSha, to_sha256: current.sha256, from, to: current, payload_canonical_sha256: payloadCanonicalSha256(JSON.parse(oldRaw)), changed_top_level_fields: ['dependencies'], source_evidence: {archive: 'verified-release.zip', archive_sha256: 'a'.repeat(64), release_manifest_sha256: 'b'.repeat(64), archive_member_path: originalPath, archive_member_sha256: fromSha}};
  };
  const manifest = {schema_version: '1.0', algorithm_version: constants.ALGORITHM, canonical_algorithm: constants.CANONICAL, allowed_changed_top_level_fields: ['dependencies'], migrations: [record('small_body_appearance_manifest_sha256', oldSmallRaw, currentSmall), record('mass_scenarios_manifest_sha256', oldMassRaw, currentMass)]};
  const save = () => write(constants.MANIFEST, manifest); save();
  return {root, manifest, write, save};
}

test('only the registered two dependency-only reference transitions are accepted', () => {
  const f = fixture(), migrations = verifiedMigrations(f.root); assert.equal(migrations.length, 2);
  for (const record of f.manifest.migrations) assert.deepEqual(resolveDisplayCompatibility(f.root, record.field, record.from_sha256, record.to_sha256), {field: record.field, from_sha256: record.from_sha256, to_sha256: record.to_sha256});
  const first = f.manifest.migrations[0];
  assert.equal(resolveDisplayCompatibility(f.root, first.field, 'c'.repeat(64), first.to_sha256), null);
  assert.equal(resolveDisplayCompatibility(f.root, 'appearance_manifest_sha256', first.from_sha256, first.to_sha256), null);
  assert.equal(resolveDisplayCompatibility(f.root, 'toString', first.from_sha256, first.to_sha256), null);
});
test('a changed scientific value remains rejected even when the current file record is rehashed', () => {
  const f = fixture(), record = f.manifest.migrations[1];
  const changed = JSON.parse(fs.readFileSync(path.join(f.root, record.to.path))); changed.model.density = 985;
  record.to = f.write(record.to.path, changed); record.to_sha256 = record.to.sha256; f.save();
  assert.throws(() => verifiedMigrations(f.root), error => error.details?.reason === 'scientific_payload_changed');
});
test('nested dependencies and dates are part of the scientific payload, not part of the exception', () => {
  for (const change of [value => { value.created_utc = '2026-11-15T00:00:00Z'; }, value => { value.profiles.sedna.nested.dependencies.not_top_level = 'changed'; }]) {
    const f = fixture(), record = f.manifest.migrations[0], changed = JSON.parse(fs.readFileSync(path.join(f.root, record.to.path)));
    change(changed); record.to = f.write(record.to.path, changed); record.to_sha256 = record.to.sha256; f.save();
    assert.throws(() => verifiedMigrations(f.root), error => error.details?.reason === 'scientific_payload_changed');
  }
});
test('modified original bytes, path escapes and nonvisual dependency rebases fail closed', () => {
  const f = fixture(), original = f.manifest.migrations[0].from;
  fs.appendFileSync(path.join(f.root, original.path), ' ');
  assert.throws(() => verifiedMigrations(f.root), error => error.details?.reason === 'file_size_mismatch');
  const g = fixture(); g.manifest.migrations[0].from.path = '../outside.json'; g.save();
  assert.throws(() => verifiedMigrations(g.root), error => error.details?.reason === 'migration_paths');
  const h = fixture(), record = h.manifest.migrations[0], changed = JSON.parse(fs.readFileSync(path.join(h.root, record.to.path)));
  changed.dependencies['extended_solar.json'] = h.write('data/manifests/extended_solar.json', {physics: 'changed'});
  record.to = h.write(record.to.path, changed); record.to_sha256 = record.to.sha256; h.save();
  assert.throws(() => verifiedMigrations(h.root), error => error.details?.reason === 'nonvisual_dependency_changed');
});
test('typed canonical values retain order, types and numeric sign while ignoring object-key order', () => {
  assert.equal(semanticCanonical({b: [1, '1', true], a: null}), semanticCanonical({a: null, b: [1, '1', true]}));
  assert.notEqual(semanticCanonical([1, 2]), semanticCanonical([2, 1]));
  assert.notEqual(semanticCanonical(1), semanticCanonical('1'));
  assert.notEqual(semanticCanonical(-0), semanticCanonical(0));
  assert.throws(() => semanticCanonical(Infinity));
});
test('the real archived manifests and Python standard-library verifier agree on both scientific payload digests', t => {
  const result = verifiedMigrations(ROOT); assert.equal(result.length, 2);
  const python = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (!fs.existsSync(python)) { t.skip('Optional build-time Python interpreter is unavailable; the Node verification ran.'); return; }
  const script = 'from pathlib import Path; import json,sys; from science.display_compatibility import verified_migrations; print(json.dumps(verified_migrations(Path(sys.argv[1]))))';
  const child = spawnSync(python, ['-X', 'utf8', '-c', script, ROOT], {cwd: ROOT, encoding: 'utf8', timeout: 15000});
  assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), result);
});

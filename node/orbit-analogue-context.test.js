'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { validator, sessionRules, orbitAnalogueContextReasons } = require('./schema');
const { createOuterCatalog } = require('./outer-tno');
const rule = 'tno-source-aei-exploratory-v1', version = 'actual-analogue-top5-v1';
const base = { selected_object_id: 'pluto', model_epoch: '2026-11-14T00:00:00Z', source_manifest_sha256: 'a'.repeat(64) };
const analogue = (sha = 'b'.repeat(64)) => ({ algorithm_version: rule, hypothesis: { a_au: 400, e: .2, i_deg: 15, epoch_jd_tdb: 2458270 }, source_manifest_sha256: sha });
const pinned = (sha) => ({ ...base, scene_filter: 'p9-reference', scene_filter_version: version, orbit_analogue_context: analogue(sha) });
const current = () => ({ source_manifest_sha256: 'b'.repeat(64), source_algorithm_version: 'jpl-sbdb-tno-two-body-v1', coordinate_frame: 'heliocentric_IAU76_80_ecliptic_J2000', time_scale: 'TDB' });
const validate = validator(JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/openapi.json'), 'utf8')));

test('legacy filters remain unversioned and optional context does not alter the saved envelope', () => {
  for (const scene_filter of [undefined, 'all', 'confirmed-planets', 'p9-reference', 'planets-and-p9']) {
    const input = { ...base, ...(scene_filter === undefined ? {} : { scene_filter }) }, before = JSON.stringify(input);
    const restored = validate('UniverseContext', input);
    assert.equal(restored.scene_filter_version, undefined); assert.equal(restored.orbit_analogue_context, undefined);
    assert.deepEqual(orbitAnalogueContextReasons(input, undefined), []);
    assert.equal(JSON.stringify(input), before);
  }
});

test('versioned TOP 5 requires the declared comparison inputs in direct and nested validation', () => {
  const input = pinned(), before = JSON.stringify(input), restored = validate('UniverseContext', input);
  assert.deepEqual(restored.orbit_analogue_context, input.orbit_analogue_context);
  assert.equal(JSON.stringify(input), before);
  for (const scene_filter of ['p9-reference', 'planets-and-p9']) {
    const incomplete = { ...base, scene_filter, scene_filter_version: version };
    assert.throws(() => validate('UniverseContext', incomplete), /invalid_request/);
    const session = { object_id: 'pluto', observation_ids: ['S12', 'S14'], universe_context: incomplete };
    assert.throws(() => validate('Session', session), /invalid_request/);
    assert.throws(() => sessionRules(session), /invalid_request/);
  }
  assert.throws(() => validate('UniverseContext', { ...base, orbit_analogue_context: analogue() }), /invalid_request/);
  for (const scene_filter of ['all', 'confirmed-planets']) assert.doesNotThrow(() => validate('UniverseContext', { ...base, scene_filter, scene_filter_version: version }));
});

test('hypothesis fields are strict finite numbers in the adopted range', () => {
  for (const [key, value] of [['a_au', 0], ['a_au', -1], ['a_au', 2000.01], ['a_au', '400'], ['e', -.01], ['e', 1], ['e', .99001], ['e', true], ['i_deg', -.01], ['i_deg', 180.01], ['epoch_jd_tdb', 625697.49], ['epoch_jd_tdb', 2816787.51], ['a_au', NaN], ['e', Infinity], ['i_deg', -Infinity]]) {
    const input = pinned(); input.orbit_analogue_context.hypothesis[key] = value;
    assert.throws(() => validate('UniverseContext', input), /invalid_request/, key + '=' + value);
  }
  for (const hypothesis of [{ a_au: 2000, e: .99, i_deg: 180, epoch_jd_tdb: 2816787.5 }, { a_au: .001, e: 0, i_deg: 0, epoch_jd_tdb: 625697.5 }]) {
    const input = pinned(); input.orbit_analogue_context.hypothesis = hypothesis;
    assert.doesNotThrow(() => validate('UniverseContext', input));
  }
  for (const change of [{ algorithm_version: 'future-rule' }, { source_manifest_sha256: 'bad' }, { source_manifest_sha256: 'A'.repeat(64) }, { rows: ['sbdb-1'] }, { hypothesis: { ...analogue().hypothesis, score: .9 } }]) {
    assert.throws(() => validate('UniverseContext', { ...pinned(), orbit_analogue_context: { ...analogue(), ...change } }), /invalid_request/);
  }
  assert.throws(() => validate('UniverseContext', { ...base, scene_filter_version: 'old-reference-v0' }), /invalid_request/);
});

test('source changes require explicit recalculation and no helper mutates the evidence', () => {
  const saved = pinned(), source = current(), before = JSON.stringify({ saved, source });
  assert.deepEqual(orbitAnalogueContextReasons(saved, source), []);
  assert.deepEqual(orbitAnalogueContextReasons(saved, { ...source, source_manifest_sha256: 'f'.repeat(64) }), ['orbit_analogue_sources_changed']);
  assert.deepEqual(orbitAnalogueContextReasons(saved, source, 'future-rule'), ['orbit_analogue_algorithm_changed']);
  for (const unavailable of [undefined, null, { source_manifest_sha256: 'b'.repeat(64) }, { ...source, time_scale: 'UTC' }, { ...source, coordinate_frame: 'ICRS' }, { ...source, source_algorithm_version: 'future-source' }]) {
    assert.deepEqual(orbitAnalogueContextReasons(saved, unavailable), ['orbit_analogue_data_unavailable']);
  }
  assert.equal(JSON.stringify({ saved, source }), before);
});

function sourceFixture(root) {
  function write(relative, value) {
    const file = path.join(root, relative), raw = Buffer.from(JSON.stringify(value));
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw);
    return { local_relative_path: relative, bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') };
  }
  const source = write('data/reference/outer-tno/source.json', { count: '1', fields: ['spkid', 'a', 'e', 'i', 'w', 'om', 'ma', 'epoch'], data: [['999', null, null, null, null, null, null, null]] });
  source.request_metadata = write('data/reference/outer-tno/request.json', { count: 1 });
  const identity = write('data/reference/outer-tno/identity.json', { signature: { version: '1.0', source: 'NASA/JPL SBDB (Small-Body DataBase) Query API' }, count: '1', fields: ['spkid', 'kind', 'prefix', 'pdes', 'full_name', 'class'], data: [['999', 'au', null, '2014 SO263', '(2014 SO263)', 'TNO']] });
  write('data/reference/outer-tno/r029-r031-20261115/jpl-tno-identity-bulk.source.json', { path: identity.local_relative_path, bytes: identity.bytes, sha256: identity.sha256, url: 'https://ssd-api.jpl.nasa.gov/sbdb_query.api' });
  const manifest = { schema_version: '1.0', algorithm_version: 'jpl-sbdb-tno-two-body-v1', time_scale: 'TDB', coordinate_frame: 'heliocentric_IAU76_80_ecliptic_J2000', source, selection: { reported_count: 1, complete_response: true }, reference_jd_tdb: 2461000, limitations: [], references: [], objects: [{ object_id: 'sbdb-999', spkid: '999', pdes: '2014 SO263', name: '(2014 SO263)', known_object_id: null, catalog_class: 'TNO', orbit: null }] };
  const store = () => write('data/manifests/outer_tno.json', manifest).sha256;
  return { manifest, store };
}

test('the server catalogue path verifies original source bytes before checking the saved TOP 5 hash', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'planetx-analogue-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { manifest, store } = sourceFixture(root), saved = pinned(store());
  assert.deepEqual(orbitAnalogueContextReasons(saved, createOuterCatalog(root).catalog()), []);
  // The manifest and its declared SHA remain unchanged, but actual source bytes do not.
  fs.appendFileSync(path.join(root, manifest.source.local_relative_path), ' ');
  assert.throws(() => createOuterCatalog(root), /outer_source_integrity/);
});

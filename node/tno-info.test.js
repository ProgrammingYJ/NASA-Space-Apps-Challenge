'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createTnoInformation, constants } = require('./tno-info');
const ROOT = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'data/manifests/outer_tno.json'));
const snapshot = JSON.parse(raw), sha = crypto.createHash('sha256').update(raw).digest('hex');
const information = createTnoInformation(ROOT, snapshot.objects, sha);

test('only the selected detail gets the new information while list and orbital versions remain unchanged', () => {
  const catalog = require('./outer-tno').createOuterCatalog(ROOT), list = catalog.catalog();
  assert.equal(list.algorithm_version, 'jpl-sbdb-tno-two-body-v2');
  assert.equal(list.source_algorithm_version, 'jpl-sbdb-tno-two-body-v1');
  assert.ok(list.objects.every(row => !Object.hasOwn(row, 'info')));
  const detail = catalog.object('sbdb-54538127', snapshot.reference_jd_tdb);
  assert.equal(detail.info.designation.value, '2015 FO563');
  assert.equal(detail.algorithm_version, list.algorithm_version);
  assert.equal(detail.full_orbit_au.length, 257);
});

test('all8341 exact string identities have bounded factual descriptions without inventing measurements', () => {
  const counts = { numbered: 0, unnumbered: 0, aPrefix: 0, diameter: 0, mass: 0 };
  for (const row of snapshot.objects) {
    const value = information(row);
    assert.equal(value.object_id, row.object_id); assert.equal(value.designation.value, row.pdes);
    assert.equal(typeof row.spkid, 'string'); assert.equal(value.provenance.snapshot_manifest_sha256, sha);
    assert.equal(value.orbit_class.iau_planet_status_inferred, false);
    assert.equal(value.marker.physical_radius, false); assert.equal(value.marker.resolved_photo, false);
    assert.equal(value.uncertainty.propagated_position_covariance, null);
    assert.equal(value.observations.normalized_rms_unit, 'dimensionless');
    if (value.designation.jpl_kind === 'an') counts.numbered++;
    if (value.designation.jpl_kind === 'au') counts.unnumbered++;
    if (value.designation.prefix === 'A') { counts.aPrefix++; assert.equal(value.designation.type, 'asteroid_comet_style'); assert.equal(value.designation.jpl_kind, 'au'); }
    if (value.reported_in_this_snapshot.diameter) counts.diameter++;
    if (value.reported_in_this_snapshot.mass) counts.mass++;
    assert.ok(JSON.stringify(value).length < 4000);
  }
  assert.deepEqual(counts, { numbered: 1049, unnumbered: 7292, aPrefix: 18, diameter: 13, mass: 0 });
});

test('2015FO563 retains its real designation and extremely uncertain short-arc facts', () => {
  const row = snapshot.objects.find(o => o.spkid === '54538127'), value = information(row);
  assert.equal(value.designation.type, 'provisional_designation');
  assert.equal(value.designation.iau_name, null); assert.equal(value.observations.arc_days, 7);
  assert.equal(value.observations.count, 10); assert.equal(value.observations.condition_code, '9');
  assert.equal(value.uncertainty.highly_uncertain_condition, true);
  assert.equal(value.uncertainty.sigma_a_at_least_nominal_a, true);
  assert.equal(value.uncertainty.sigma_a_au, 3844.3);
  assert.equal(value.observations.dates_are_discovery_dates, false);
  assert.equal(row.physical.mass_kg, null); assert.equal(row.physical.diameter_km, null);
  assert.equal(value.observations.normalized_rms, .14971);
});

test('missing orbital phase does not erase identification or the independent orbit-solution metadata', () => {
  const row = snapshot.objects.find(o => o.orbit === null), value = information(row);
  assert.ok(row); assert.equal(value.record_kind, 'observed_catalogue_small_body');
  assert.equal(value.object_id, row.object_id); assert.equal(value.orbit_class.code, 'TNO');
  assert.ok(value.orbit_facts.elements_epoch_jd_tdb > 0);
});

test('supplementary data cannot attach to a different SPK-ID or designation', () => {
  const row = snapshot.objects[0];
  assert.throws(() => information({ ...row, spkid: '1' }), /snapshot_identity_mismatch/);
  assert.throws(() => information({ ...row, pdes: '2015 FO563' }), /snapshot_identity_mismatch/);
});

test('corrupt identity response is rejected instead of serving unsourced descriptions', () => {
  const base = path.join(ROOT, 'tmp'); fs.mkdirSync(base, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(base, 'tno-info-integrity-'));
  try {
    const record = JSON.parse(fs.readFileSync(path.join(ROOT, constants.RECORD), 'utf8'));
    const recordFile = path.join(temporary, constants.RECORD), sourceFile = path.join(temporary, record.path);
    fs.mkdirSync(path.dirname(recordFile), { recursive: true });
    fs.writeFileSync(recordFile, JSON.stringify(record)); fs.writeFileSync(sourceFile, '{}');
    assert.throws(() => createTnoInformation(temporary, snapshot.objects, sha), /source_integrity/);
  } finally {
    const resolved = fs.realpathSync(temporary), parent = fs.realpathSync(base) + path.sep;
    assert.ok(resolved.startsWith(parent)); fs.rmSync(resolved, { recursive: true, force: true });
  }
});

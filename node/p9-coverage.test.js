'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { coverageService, makeQuery, readTable, allowedArchiveLink } = require('./p9-coverage');
const orbit = { a_au: 500, e: .2, i_deg: 15, omega_deg: 200, Omega_deg: 40, M_deg: 10, epoch_jd_tdb: 2458270, mass_earth: 5 };
const normalizeOrbit = value => { assert.equal(typeof value.a_au, 'number'); return value; };
const columns = ['ra_obj', 'dec_obj', 'observationid', 'productid', 'instrument', 'start_date', 'end_date', 'uri'];
function table(rows = []) {
  const widths = [12, 12, 22, 12, 12, 25, 25, 180];
  return ['\\catalog = "spherex"', '|' + columns.map((k, i) => k.padEnd(widths[i])).join('|') + '|', '|' + columns.map((_, i) => 'char'.padEnd(widths[i])).join('|') + '|', ...rows.map(row => columns.map((k, i) => ' ' + String(row[k] || '').padEnd(widths[i])).join(''))].join('\n');
}
const row = { ra_obj: '306.106130', dec_obj: '-23.718212', observationid: '2026W40_1A_0373_4', productid: 'D3', instrument: 'SPHEREx', start_date: '2026-09-29 16:32:21.692', end_date: '2026-09-29 16:34:16.809', uri: 'ibe/data/spherex/qr3/level2/test.fits' };
test('MOST query converts raw JD to MJD once and uses argument of perihelion explicitly', () => {
  const query = makeQuery({ orbit, start_date: '2026-09-29', end_date: '2026-10-02' }, normalizeOrbit);
  assert.equal(query.epoch, '58269.5'); assert.equal(query.arg_perihelion, '200'); assert.equal(query.ascend_node, '40');
  assert.equal(query.output_mode, 'Brief'); assert.equal(query.obs_end, '2026 10 02 23:59:59');
  assert.throws(() => makeQuery({ orbit, start_date: '2026-02-30', end_date: '2026-03-01' }, normalizeOrbit));
  assert.throws(() => makeQuery({ orbit, start_date: '2026-01-01', end_date: '2026-03-01' }, normalizeOrbit));
  assert.throws(() => makeQuery({ orbit, start_date: '2026-01-01', end_date: '2026-01-02', url: 'http://localhost' }, normalizeOrbit));
});
test('fixedwidth SPHEREx response preserves full ID, detector, coordinates and metadata', () => {
  const result = readTable(table([row])); assert.equal(result.length, 1); assert.equal(result[0].observation_id, row.observationid); assert.equal(result[0].detector, 'D3');
  assert.equal(result[0].ra_deg, 306.106130); assert.equal(result[0].dec_deg, -23.718212);
  assert.equal(result[0].original_url, 'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/test.fits');
  assert.deepEqual(readTable(table([])), []);
  assert.throws(() => readTable('<html>Error</html>')); assert.throws(() => readTable('ERROR no images found'));
  assert.throws(() => readTable('\\status = "ERROR"\n' + table([])));
  assert.equal(allowedArchiveLink('https://evil.example/ibe/data/spherex/test'), null);
  assert.equal(allowedArchiveLink('http://irsa.ipac.caltech.edu/ibe/data/spherex/test'), null);
  assert.equal(allowedArchiveLink('ibe/data/spherex/../../test'), null);
});
test('coverage cache stores original response and validates digest; failures are not empty success', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-cov-test-')); let requests = 0;
  const fetcher = async url => { requests++; assert.equal(url.hostname, 'irsa.ipac.caltech.edu'); return new Response(table([row])); };
  const service = coverageService({ stateDir, normalizeOrbit, fetcher }), input = { orbit, start_date: '2026-09-29', end_date: '2026-10-02' };
  const first = await service.query(input); assert.equal(first.status, 'coverage_available'); assert.equal(first.row_count, 1); assert.equal(first.cache_hit, false);
  const cached = await service.query(input); assert.equal(cached.cache_hit, true); assert.equal(requests, 1); assert.equal(cached.raw_response, first.raw_response);
  assert.equal(service.verifyForSave(cached).response_sha256, first.response_sha256);
  assert.throws(() => service.verify({ ...first, raw_response: first.raw_response + 'x' }));
  const failed = coverageService({ stateDir: fs.mkdtempSync(path.join(os.tmpdir(), 'p9-cov-error-')), normalizeOrbit, fetcher: async () => new Response('<html>temporarily unavailable</html>') });
  const error = await failed.query(input); assert.equal(error.status, 'service_error'); assert.equal(error.row_count, 0); assert.ok(error.error.code);
  assert.throws(() => service.verify({ ...error, rows: first.rows, row_count: 1 }));
});
module.exports = { table, row };

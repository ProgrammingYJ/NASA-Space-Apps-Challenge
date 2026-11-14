'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');

async function stopOwned(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  let timer;
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); }),
  ]);
  clearTimeout(timer);
  if (!stopped) { child.kill('SIGKILL'); await exited; }
}

async function checkEntrypoint(overrides, checkPort) {
  const env = { ...process.env };
  delete env.PORT;
  delete env.APP_PORT;
  Object.assign(env, overrides);
  env.APP_STATE_DIR = fs.mkdtempSync(path.join(root, 'tmp', 'node-entrypoint-test-'));
  const child = spawn(process.execPath, ['app.js'], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', errors = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', data => { errors += data; });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Node entrypoint did not listen: ' + errors)), 20000);
      const finish = (error, value) => { clearTimeout(timeout); if (error) reject(error); else resolve(value); };
      child.once('error', error => finish(error));
      child.once('exit', (code, signal) => finish(new Error(`Node entrypoint exited (${code}/${signal}): ${errors}`)));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', data => {
        output += data;
        const match = output.match(/Planet X Node runtime listening on port (\d+)/);
        if (match) finish(null, Number(match[1]));
      });
    });
    checkPort(port);
    const response = await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'live' });
  } finally {
    await stopOwned(child);
  }
}

test('node app.js uses the MCSM default port and preserves explicit environment overrides', { timeout: 60000 }, async t => {
  await t.test('without PORT or APP_PORT the actual server listens on 3002', async () => {
    await checkEntrypoint({}, port => assert.equal(port, 3002));
  });
  await t.test('PORT takes precedence over APP_PORT and accepts an ephemeral port', async () => {
    await checkEntrypoint({ PORT: '0', APP_PORT: 'invalid' }, port => {
      assert.ok(Number.isInteger(port) && port > 0 && port !== 3002);
    });
  });
  await t.test('APP_PORT remains effective when PORT is absent', async () => {
    await checkEntrypoint({ APP_PORT: '0' }, port => {
      assert.ok(Number.isInteger(port) && port > 0 && port !== 3002);
    });
  });
});

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function strict(value, depth = 0) {
  if (depth > 100) throw new Error('invalid_json_depth');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('invalid_json_number');
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('invalid_json_key');
      strict(item, depth + 1);
    }
  }
  return value;
}
function parse(text) { return strict(JSON.parse(text)); }
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
function canonical(value) { strict(value); return JSON.stringify(sorted(value)); }
function hash(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('path_escape');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('path_escape');
  // Real paths prevent a symlink inside the allowed directory escaping it.
  const real = fs.realpathSync(absolute), base = fs.realpathSync(root);
  if (!real.startsWith(base + path.sep)) throw new Error('path_escape');
  return real;
}
function atomicRaw(file, raw) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), '.' + path.basename(file) + '.' + crypto.randomUUID() + '.tmp');
  let fd;
  try { fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, raw); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; fs.renameSync(temporary, file); }
  finally { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(temporary); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
function atomic(file, value) { atomicRaw(file, canonical(value)); }
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return true;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
function lock(state) {
  fs.mkdirSync(state, { recursive: true });
  const legacy = path.join(state, 'worker.json');
  if (fs.existsSync(legacy) && alive(parse(fs.readFileSync(legacy, 'utf8')).pid)) throw new Error('python_state_in_use');
  const directory = path.join(state, 'node-api.lock'), owner = path.join(directory, 'owner.json');
  try { fs.mkdirSync(directory); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = parse(fs.readFileSync(owner, 'utf8'));
    if (alive(previous.pid)) throw new Error('state_directory_in_use');
    // Remove only the two exact, verified lock paths, never a state subtree.
    fs.unlinkSync(owner); fs.rmdirSync(directory); fs.mkdirSync(directory);
  }
  const token = crypto.randomUUID();
  fs.writeFileSync(owner, canonical({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
  return () => { try { if (parse(fs.readFileSync(owner, 'utf8')).token === token) { fs.unlinkSync(owner); fs.rmdirSync(directory); } } catch {} };
}
module.exports = { parse, strict, canonical, hash, safePath, atomic, atomicRaw, lock };

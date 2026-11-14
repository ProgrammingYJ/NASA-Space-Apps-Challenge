'use strict';
// Verify every declared member before activation. No dependencies are required.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = fs.realpathSync(process.argv[2] || '.');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release_manifest.json'), 'utf8'));
if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error('missing release file inventory');
let total = 0;
for (const file of manifest.files) {
  const relative = file.path;
  if (typeof relative !== 'string' || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid member path');
  const target = path.resolve(root, relative);
  const real = fs.realpathSync(target);
  if (!real.startsWith(root + path.sep) || !fs.statSync(real).isFile()) throw new Error('member outside release or not a file');
  const data = fs.readFileSync(real);
  if (data.length !== file.bytes || crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`release digest mismatch: ${relative}`);
  total += data.length;
}
console.log(JSON.stringify({ status: 'verified', files: manifest.files.length, bytes: total, release: manifest.release_version || manifest.version || null }));

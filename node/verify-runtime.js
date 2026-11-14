'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { Sources } = require('./sources');
const { hash } = require('./storage');
const { SOURCE_VERIFICATION_POLICY } = require('./verification-policy');
async function verifyRuntime(root = path.join(__dirname, '..')) {
  const sources = new Sources(root);
  try {
    // Explicit audit always reads and hashes all bytes, even after warm-up.
    await sources.call('verify', null, true);
    const manifest = await sources.call('manifest');
    const report = { status: 'verified', runtime: 'node', verification: 'full_sha256_audit', source_manifest_sha256: hash(fs.readFileSync(path.join(root, 'data/node-runtime/runtime_manifest.json'))), generated_files: manifest.files.length, required_sources: manifest.source_files.filter(file => file.runtime_required).length, verification_policy: SOURCE_VERIFICATION_POLICY };
    console.log(JSON.stringify(report)); return report;
  } finally { await sources.close(); }
}
module.exports = { verifyRuntime };

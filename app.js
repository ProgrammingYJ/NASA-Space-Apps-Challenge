'use strict';
const { start } = require('./node/server');
if (require.main === module) {
  const operation = process.argv.includes('--verify-sources') ? require('./node/verify-runtime').verifyRuntime() : start({ port: Number(process.env.PORT || process.env.APP_PORT || 3002) });
  operation.catch(() => { console.error('Node runtime could not start or verify sources; check port, state ownership and runtime bundle.'); process.exitCode = 1; });
}
module.exports = { start };

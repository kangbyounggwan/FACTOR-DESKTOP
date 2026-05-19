// Post-build helper for electron main process.
// Root package.json uses "type": "module" (ESM for vite),
// but tsc compiles electron/ to CommonJS.
// Write dist-electron/package.json with {"type":"commonjs"} so
// Node treats compiled main.js as CommonJS.

const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'dist-electron');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);
console.log('[post-build-electron] wrote dist-electron/package.json');

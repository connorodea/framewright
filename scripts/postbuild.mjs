// Postbuild: prepare dist/index.js to ship as an npm bin.
//
// 1. Ensure the file starts with `#!/usr/bin/env node`. TypeScript preserves
//    shebangs by default in modern versions, but if a future change strips it
//    (e.g. a different bundler, esbuild, swc), we restore it here so the
//    published bin is always runnable.
// 2. Mark the file executable (0o755). Without this, `npm install -g` produces
//    a bin that the OS refuses to exec on Unix-likes.
//
// Idempotent — safe to run multiple times.

import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(__dirname, '..', 'dist', 'index.js');
const SHEBANG = '#!/usr/bin/env node';

if (!existsSync(distEntry)) {
  console.error(`postbuild: ${distEntry} not found — did tsc run?`);
  process.exit(1);
}

const contents = readFileSync(distEntry, 'utf8');
if (!contents.startsWith(SHEBANG)) {
  writeFileSync(distEntry, `${SHEBANG}\n${contents}`);
  console.error('postbuild: prepended shebang to dist/index.js');
}

chmodSync(distEntry, 0o755);
console.error('postbuild: set dist/index.js mode to 0755');

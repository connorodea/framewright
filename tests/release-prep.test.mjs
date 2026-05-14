// Release-prep gate: verifies dist/index.js is shippable to npm.
// Run via `npm run release-check` (which builds first) or directly:
//   node --test tests/release-prep.test.mjs
//
// Uses node:test so it works without any test framework deps.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const distEntry = resolve(repoRoot, 'dist/index.js');

test('compiled bin starts with #!/usr/bin/env node shebang', () => {
  const contents = readFileSync(distEntry, 'utf8');
  const firstLine = contents.split('\n', 1)[0];
  assert.equal(
    firstLine,
    '#!/usr/bin/env node',
    `dist/index.js must start with "#!/usr/bin/env node" so global installs are runnable. Got: ${JSON.stringify(firstLine)}`,
  );
});

test('compiled bin is executable (has at least one execute bit)', () => {
  const { mode } = statSync(distEntry);
  // Permission bits are the low 9 of mode. Any execute bit (user/group/other) is fine.
  const anyExecuteBit = mode & 0o111;
  assert.ok(
    anyExecuteBit !== 0,
    `dist/index.js must have at least one execute bit set so the bin is runnable. Got mode ${(mode & 0o777).toString(8)}`,
  );
});

test('npm publish --dry-run ships exactly dist/, README.md, LICENSE, package.json', () => {
  // Run npm in JSON mode so the file list is structured.
  const stdout = execFileSync('npm', ['publish', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // `npm publish --dry-run` runs `prepublishOnly` which can emit non-JSON
  // chatter to stdout. The JSON document itself is a single top-level object,
  // so slice from the first `{` to the last `}`.
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  assert.ok(
    start !== -1 && end !== -1,
    `npm publish --dry-run produced no JSON object. stdout: ${stdout}`,
  );
  const payload = JSON.parse(stdout.slice(start, end + 1));
  const paths = payload.files.map((f) => f.path).sort();

  // No paths from forbidden locations.
  const forbiddenPrefixes = ['src/', 'tests/', 'scripts/', 'node_modules/', '.github/'];
  const forbiddenExact = new Set([
    'tsconfig.json',
    '.env',
    '.env.example',
    '.env.local',
    '.gitignore',
  ]);

  for (const p of paths) {
    for (const prefix of forbiddenPrefixes) {
      assert.ok(
        !p.startsWith(prefix),
        `tarball must not contain ${prefix}* — found ${p}`,
      );
    }
    assert.ok(
      !forbiddenExact.has(p),
      `tarball must not contain ${p}`,
    );
    // Belt-and-braces: nothing starting with a dot.
    assert.ok(
      !p.startsWith('.'),
      `tarball must not contain dotfiles — found ${p}`,
    );
  }

  // Every shipped path must be one of the four allowed buckets.
  const allowed = (p) =>
    p === 'package.json' ||
    p === 'README.md' ||
    p === 'LICENSE' ||
    p.startsWith('dist/');

  for (const p of paths) {
    assert.ok(allowed(p), `tarball contains unexpected path: ${p}`);
  }

  // Sanity: the things we DO want are present.
  assert.ok(paths.includes('package.json'), 'tarball missing package.json');
  assert.ok(paths.includes('README.md'), 'tarball missing README.md');
  assert.ok(paths.includes('LICENSE'), 'tarball missing LICENSE');
  assert.ok(paths.includes('dist/index.js'), 'tarball missing dist/index.js');
});

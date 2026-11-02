import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compose = readFileSync(new URL('../../infra/docker-compose.yml', import.meta.url), 'utf8');

// The dev stack carries default admin credentials, so nothing may listen beyond this machine.
test('every published port binds to 127.0.0.1 only', () => {
  const published = [...compose.matchAll(/^\s+- '([^']*:[^']*)'$/gm)]
    .map((m) => m[1])
    .filter((p) => /\d|\$\{/.test(p));
  assert.ok(published.length >= 2, `found ${published.length} published ports`);
  for (const port of published) assert.match(port, /^127\.0\.0\.1:/, port);
});

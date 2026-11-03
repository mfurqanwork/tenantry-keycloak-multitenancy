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

// The login theme is a JAR inside the image (ADR-0021), so Keycloak is built here, not pulled.
test('keycloak is built from infra/keycloak/Dockerfile so the theme JAR is inside', () => {
  const keycloak = /^ {2}keycloak:\r?\n([\s\S]*?)(?=^ {2}\S)/m.exec(compose)?.[1] ?? '';
  assert.match(keycloak, /dockerfile: infra\/keycloak\/Dockerfile/);
  assert.doesNotMatch(keycloak, /^\s+image:/m);
});

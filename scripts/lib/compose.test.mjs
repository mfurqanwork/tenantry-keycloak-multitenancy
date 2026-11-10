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

test('the dev DNS server answers on loopback only', () => {
  const dns = /^ {2}dns:\r?\n([\s\S]*?)(?=^ {2}\S)/m.exec(compose)?.[1] ?? '';
  assert.match(dns, /image: coredns\/coredns:1\.12\.1/);
  assert.match(dns, /'127\.0\.0\.1:\$\{TENANTRY_DNS_PORT:-1053\}:53\/udp'/);
});

// Secrets the API writes into the bind-mounted folder belong to the host user, who reads them with
// `pnpm ops` (Phase 5b); dev-stack sets the ids on Linux and macOS, root stays the default elsewhere.
test('the API container runs as the host user dev-stack names', () => {
  const api = /^ {2}api:\r?\n([\s\S]*?)(?=^ {2}\S)/m.exec(compose)?.[1] ?? '';
  assert.match(api, /user: '\$\{TENANTRY_UID:-0\}:\$\{TENANTRY_GID:-0\}'/);
});

// /health/ready lists each check, and one of them says UP even while Keycloak is still starting; only the
// HTTP status says the whole server is ready (Phase 6b's first deploy waited on a false "healthy").
for (const file of ['../../infra/docker-compose.yml', '../../infra/prod/compose.prod.yml']) {
  test(`${file.split('/').pop()}: Keycloak is healthy only on a 200 from /health/ready`, () => {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    const keycloak = /^ {2}keycloak:\r?\n([\s\S]*?)(?=^ {2}\S)/m.exec(text)?.[1] ?? '';
    assert.match(keycloak, /grep -q 'HTTP\/1\.1 200'/);
    assert.doesNotMatch(keycloak, /grep -q UP/);
  });
}

test('the production Keycloak keeps its caches local: one server, no cluster to find', () => {
  const dockerfile = readFileSync(new URL('../../infra/keycloak/Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /kc\.sh build [^\n]*--cache=local/);
});

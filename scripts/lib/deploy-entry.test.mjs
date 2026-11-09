import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../infra/prod/deploy-entry.sh', import.meta.url));
const run = (command) =>
  spawnSync('bash', [script], {
    env: { ...process.env, SSH_ORIGINAL_COMMAND: command, TENANTRY_ENTRY_CHECK_ONLY: '1' },
    encoding: 'utf8',
  });

test('the deploy key can pass a version', () => {
  const result = run('1.20.3');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ok 1\.20\.3/);
});

for (const bad of ['', 'bash', '1.2', 'v1.2.3', '1.2.3; rm -rf /', '1.2.3\nid', '$(id)', '../1.2.3']) {
  test(`the deploy key cannot pass ${JSON.stringify(bad)}`, () => {
    assert.equal(run(bad).status, 2);
  });
}

const compose = readFileSync(new URL('../../infra/prod/compose.prod.yml', import.meta.url), 'utf8');
const caddyfile = readFileSync(new URL('../../infra/prod/Caddyfile', import.meta.url), 'utf8');

test('in production only Caddy publishes ports', () => {
  const published = [...compose.matchAll(/^\s+- '(\d+:\d+)'$/gm)].map((m) => m[1]);
  assert.deepEqual(published, ['80:80', '443:443']);
  assert.equal(compose.match(/^ {4}ports:/gm).length, 1);
});

test('the mail relay never sends to .test addresses', () => {
  assert.match(compose, /blocked-recipients: '\\\.test\$\$'/);
});

test('production has no dev-only services or start-dev', () => {
  assert.doesNotMatch(compose, /start-dev|coredns/);
});

test('tenant web hosts send /scim/* to the API; portal and base hosts do not', () => {
  const site = (start) => {
    const at = caddyfile.indexOf(`\n${start} {`);
    assert.ok(at >= 0, start);
    return caddyfile.slice(at, caddyfile.indexOf('\n}\n', at));
  };
  assert.match(site('*.{$TENANTRY_BASE_DOMAIN}'), /\/scim\/\*/);
  assert.doesNotMatch(site('*.portal.{$TENANTRY_BASE_DOMAIN}'), /\/scim/);
  assert.doesNotMatch(site('{$TENANTRY_BASE_DOMAIN}'), /\/scim/);
});

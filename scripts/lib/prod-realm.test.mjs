import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionRealms } from './prod-realm.mjs';

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../../infra/keycloak/${name}`, import.meta.url), 'utf8'));
const { platform, corp } = productionRealms({
  platform: read('platform-realm.json'),
  corp: read('corp-demo-realm.json'),
  baseDomain: 'tenantry.pengopal.com',
});
const client = (realm, id) => realm.clients.find((c) => c.clientId === id);

test('nothing local or dev-only is left in the production realms', () => {
  for (const realm of [platform, corp]) {
    const text = JSON.stringify(realm);
    assert.doesNotMatch(text, /localhost/);
    assert.doesNotMatch(text, /"dev-/);
    assert.doesNotMatch(text, /http:\/\//);
  }
});

test('the web client signs in on the production address only', () => {
  assert.deepEqual(client(platform, 'tenantry-web').redirectUris, ['https://tenantry.pengopal.com/*']);
});

test('mail leaves from the real domain, through the internal relay', () => {
  assert.equal(platform.smtpServer.from, 'no-reply@tenantry.pengopal.com');
  assert.equal(platform.smtpServer.host, 'mailpit');
});

test('every secret is read from the environment at import', () => {
  assert.equal(client(platform, 'tenantry-backend').secret, '${KEYCLOAK_BACKEND_CLIENT_SECRET}');
  assert.equal(client(platform, 'tenantry-ops').secret, '${KEYCLOAK_OPS_CLIENT_SECRET}');
  assert.equal(client(platform, 'tenantry-isolation-tests').secret, '${TENANTRY_ISOLATION_CLIENT_SECRET}');
  assert.equal(client(corp, 'tenantry-platform').secret, '${CORP_DEMO_CLIENT_SECRET}');
});

test('the password-grant client is off unless the seed turns it on', () => {
  assert.equal(client(platform, 'tenantry-isolation-tests').enabled, false);
});

test('the company stand-in sends people back to the production broker', () => {
  assert.deepEqual(client(corp, 'tenantry-platform').redirectUris, [
    'https://auth.tenantry.pengopal.com/realms/platform/broker/*',
  ]);
});

test('the dev realm objects are left as they were', () => {
  const dev = read('platform-realm.json');
  const before = JSON.stringify(dev);
  productionRealms({ platform: dev, corp: read('corp-demo-realm.json'), baseDomain: 'x.example' });
  assert.equal(JSON.stringify(dev), before);
});

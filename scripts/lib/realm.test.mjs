import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from './env.mjs';

const realm = JSON.parse(
  readFileSync(new URL('../../infra/keycloak/platform-realm.json', import.meta.url), 'utf8'),
);
const env = parseEnv(readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'));
const client = (id) => {
  const found = (realm.clients ?? []).find((c) => c.clientId === id);
  assert.ok(found, `client ${id} is missing`);
  return found;
};
const mapper = (c, type) => (c.protocolMappers ?? []).find((m) => m.protocolMapper === type);
const groupMapper = (c) => mapper(c, 'oidc-organization-group-membership-mapper');
const audience = (c) => mapper(c, 'oidc-audience-mapper');

// Defining clientScopes in an import stops Keycloak creating its built-in scopes (organization among them),
// so clients keep the realm's default scope lists and carry their own audience mapper.
test("the import leaves Keycloak's built-in client scopes alone", () => {
  assert.equal(realm.clientScopes, undefined);
  for (const c of realm.clients ?? []) {
    assert.equal(c.defaultClientScopes, undefined, c.clientId);
    assert.equal(c.optionalClientScopes, undefined, c.clientId);
  }
});

test('self-registration is on, so signup can start in Keycloak', () => {
  assert.equal(realm.registrationAllowed, true);
});

// Invites are claimed by email (ADR-0019); only a verified address may claim one.
test('email addresses must be verified', () => {
  assert.equal(realm.verifyEmail, true);
});

test('tenantry-web is a public PKCE client for the apex host', () => {
  const web = client('tenantry-web');
  assert.equal(web.publicClient, true);
  assert.equal(web.standardFlowEnabled, true);
  assert.equal(web.directAccessGrantsEnabled, false);
  assert.equal(web.attributes?.['pkce.code.challenge.method'], 'S256');
  assert.deepEqual(web.redirectUris, ['http://tenantry.localhost/*', 'http://tenantry.localhost:8080/*']);
  assert.ok(web.webOrigins.includes('+'));
  assert.equal(audience(web)?.config['included.custom.audience'], 'tenantry-api');
  assert.equal(audience(web)?.config['access.token.claim'], 'true');
  assert.equal(groupMapper(web)?.config['access.token.claim'], 'true');
});

test('tenantry-backend is a service account with exactly the organization roles', () => {
  const backend = client('tenantry-backend');
  assert.equal(backend.publicClient, false);
  assert.equal(backend.serviceAccountsEnabled, true);
  assert.equal(backend.standardFlowEnabled, false);
  assert.equal(backend.directAccessGrantsEnabled, false);
  assert.equal(backend.secret, env.KEYCLOAK_BACKEND_CLIENT_SECRET);
  const sa = (realm.users ?? []).find((u) => u.username === 'service-account-tenantry-backend');
  assert.ok(sa, 'service account user is missing');
  assert.deepEqual([...sa.clientRoles['realm-management']].sort(), [
    'manage-clients',
    'manage-realm',
    'manage-users',
    'view-users',
  ]);
});

test('tenantry-isolation-tests gets tokens by password, like tenantry-web otherwise', () => {
  const tests = client('tenantry-isolation-tests');
  assert.equal(tests.publicClient, false);
  assert.equal(tests.directAccessGrantsEnabled, true);
  assert.equal(tests.standardFlowEnabled, false);
  assert.equal(tests.secret, env.TENANTRY_ISOLATION_CLIENT_SECRET);
  assert.equal(audience(tests)?.config['included.custom.audience'], 'tenantry-api');
  assert.equal(groupMapper(tests)?.config['access.token.claim'], 'true');
});

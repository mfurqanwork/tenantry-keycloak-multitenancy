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

test('the platform realm uses the tenantry login theme', () => {
  assert.equal(realm.loginTheme, 'tenantry');
});

test('tenantry-portal is a public PKCE client like tenantry-web, with tenant origins added at signup', () => {
  const portal = client('tenantry-portal');
  assert.equal(portal.publicClient, true);
  assert.equal(portal.standardFlowEnabled, true);
  assert.equal(portal.directAccessGrantsEnabled, false);
  assert.equal(portal.attributes?.['pkce.code.challenge.method'], 'S256');
  assert.deepEqual(portal.redirectUris, []);
  assert.equal(audience(portal)?.config['included.custom.audience'], 'tenantry-api');
  assert.equal(groupMapper(portal)?.config['access.token.claim'], 'true');
});

// Company login (ADR-0022) is run by operators through `pnpm ops`, with their own service account:
// the API's account never manages identity providers.
test('tenantry-ops is a service account that may also manage identity providers', () => {
  const ops = client('tenantry-ops');
  assert.equal(ops.publicClient, false);
  assert.equal(ops.serviceAccountsEnabled, true);
  assert.equal(ops.standardFlowEnabled, false);
  assert.equal(ops.directAccessGrantsEnabled, false);
  assert.equal(ops.secret, env.KEYCLOAK_OPS_CLIENT_SECRET);
  const sa = (realm.users ?? []).find((u) => u.username === 'service-account-tenantry-ops');
  assert.ok(sa, 'service account user is missing');
  assert.deepEqual([...sa.clientRoles['realm-management']].sort(), [
    'manage-clients',
    'manage-identity-providers',
    'manage-realm',
    'manage-users',
    'view-identity-providers',
    'view-users',
  ]);
});

test('the corp-demo realm is the stand-in company IdP, with no password in the file', () => {
  const corp = JSON.parse(
    readFileSync(new URL('../../infra/keycloak/corp-demo-realm.json', import.meta.url), 'utf8'),
  );
  const tenantry = corp.clients.find((c) => c.clientId === 'tenantry-platform');
  assert.equal(tenantry.publicClient, false);
  assert.equal(tenantry.secret, env.CORP_DEMO_CLIENT_SECRET);
  const alice = corp.users.find((u) => u.email === 'alice@acme.test');
  assert.equal(alice.emailVerified, true);
  assert.equal(alice.credentials, undefined);
});

// Enterprise realms (Phase 3, ADR-0010): one versioned template, our product clients beside it.
const template = JSON.parse(
  readFileSync(
    new URL('../../packages/keycloak-admin/templates/enterprise-realm.v1.json', import.meta.url),
    'utf8',
  ),
);
const productClient = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../packages/keycloak-admin/templates/product-clients/${name}.json`, import.meta.url),
      'utf8',
    ),
  );

test('the enterprise template enforces PKCE and safe redirect URIs on public clients, and no implicit or password grant anywhere', () => {
  assert.equal(template.templateVersion, 1);
  const profile = (name) => template.clientProfiles.profiles.find((p) => p.name === name);
  const policy = (name) => template.clientPolicies.policies.find((p) => p.name === name);
  assert.deepEqual(
    profile('tenantry-public-clients')
      .executors.map((e) => e.executor)
      .sort(),
    ['pkce-enforcer', 'secure-redirect-uris-enforcer'],
  );
  const redirects = profile('tenantry-public-clients').executors.find(
    (e) => e.executor === 'secure-redirect-uris-enforcer',
  );
  // http only where the environment allows it (local development); never a wildcard host.
  assert.equal(redirects.configuration['allow-http-scheme'], '${ALLOW_HTTP_REDIRECTS}');
  assert.equal(redirects.configuration['allow-wildcard-context-path'], true);
  assert.deepEqual(
    profile('tenantry-all-clients')
      .executors.map((e) => e.executor)
      .sort(),
    ['reject-implicit-grant', 'reject-ropc-grant'],
  );
  assert.deepEqual(policy('tenantry-public-clients').conditions, [
    { condition: 'client-access-type', configuration: { type: ['public'] } },
  ]);
  assert.equal(policy('tenantry-all-clients').conditions[0].condition, 'any-client');
  for (const name of ['tenantry-public-clients', 'tenantry-all-clients'])
    assert.equal(policy(name).enabled, true);
});

test('the enterprise template keeps the platform realm basics', () => {
  assert.equal(template.realm.verifyEmail, true);
  assert.equal(template.realm.loginTheme, 'tenantry');
  assert.equal(template.realm.registrationAllowed, false);
  assert.equal(template.realm.accessTokenLifespan, 300);
  assert.equal(template.realm.bruteForceProtected, true);
});

test('tenantry-api defines exactly the three tenant roles, and the apps put it in the audience', () => {
  const apiClient = productClient('tenantry-api');
  assert.equal(apiClient.bearerOnly, true);
  assert.deepEqual(apiClient.roles.map((r) => r.name).sort(), ['admin', 'member', 'owner']);
  for (const name of ['tenantry-web', 'tenantry-portal']) {
    const app = productClient(name);
    assert.equal(app.publicClient, true);
    assert.equal(app.attributes['pkce.code.challenge.method'], 'S256');
    assert.equal(audience(app)?.config['included.client.audience'], 'tenantry-api');
    assert.ok(!JSON.stringify(app.redirectUris).includes('*.'), `${name} has a wildcard host`);
  }
});

test('product-client templates carry no secret', () => {
  for (const name of ['tenantry-web', 'tenantry-portal', 'tenantry-api', 'tenantry-backend']) {
    assert.equal(productClient(name).secret, undefined, name);
  }
});

// Keycloak 26.8.1's reject-implicit-grant check fails with a 500 when a client leaves it unset.
test('every product client states implicitFlowEnabled: false', () => {
  for (const name of ['tenantry-web', 'tenantry-portal', 'tenantry-api', 'tenantry-backend']) {
    assert.equal(productClient(name).implicitFlowEnabled, false, name);
  }
});

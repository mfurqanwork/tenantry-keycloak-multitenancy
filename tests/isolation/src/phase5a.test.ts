import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInWithBrowser } from './helpers/browser-flow.js';
import { BASE_DOMAIN, env, HTTP_PORT } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { adminGet, deleteUser, finishSignUp } from './helpers/keycloak.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

// Phase 5a (ADR-0024): the SCIM gateway and the security settings of the seeded enterprise demo.
const INITECH = { slug: 'initech', realm: 'ent-initech', owner: 'owner@initech.test' };
const port = HTTP_PORT === 80 ? '' : `:${String(HTTP_PORT)}`;
const webRedirect = `http://${INITECH.slug}.${BASE_DOMAIN}${port}/`;
const host = tenantHost(INITECH.slug);

let owner: string;
let scimToken: string;
let standard: TestTenant;
let before: Record<string, unknown>;
const made: string[] = [];

const scim = <T = unknown>(
  method: string,
  path: string,
  o: { token?: string; body?: unknown; on?: string } = {},
) =>
  api<T>(o.on ?? host, method, `/scim/v2/${path}`, {
    ...(o.token === '' ? {} : { token: o.token ?? scimToken }),
    ...(o.body === undefined ? {} : { body: o.body, headers: { 'content-type': 'application/scim+json' } }),
  });

const signIn = (username: string, password: string) =>
  signInWithBrowser({
    realm: INITECH.realm,
    clientId: 'tenantry-web',
    redirectUri: webRedirect,
    username,
    password,
  });

async function scimPerson(): Promise<{ id: string; userName: string; password: string }> {
  const userName = `scim-${randomUUID().slice(0, 8)}@initech.test`;
  const res = await scim<{ id: string }>('POST', 'Users', {
    body: {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName,
      name: { givenName: 'Scim', familyName: 'Person' },
      emails: [{ value: userName, primary: true }],
      active: true,
    },
  });
  if (res.status !== 201) throw new Error(`SCIM create: ${String(res.status)} ${JSON.stringify(res.body)}`);
  made.push(res.body.id);
  const password = `Iso-${randomBytes(12).toString('base64url')}`;
  await finishSignUp(INITECH.realm, res.body.id, password);
  return { id: res.body.id, userName, password };
}

beforeAll(async () => {
  owner = await signIn(INITECH.owner, env('SEED_PASSWORD'));
  before = (await api<Record<string, unknown>>(host, 'GET', '/api/security', { token: owner })).body;
  const res = await api<{ token: string }>(host, 'POST', '/api/scim/token', {
    token: owner,
    body: { expiresInDays: 90 },
  });
  if (res.status !== 201) throw new Error(`SCIM token: ${String(res.status)} ${JSON.stringify(res.body)}`);
  scimToken = res.body.token;
  standard = await signupTenant('scim');
});

afterAll(async () => {
  await api(host, 'PUT', '/api/security', { token: owner, body: before });
  await api(host, 'DELETE', '/api/scim/token', { token: owner });
  for (const id of made) await deleteUser(INITECH.realm, id).catch(() => undefined);
});

describe('guarantee: SCIM gateway (Phase 5a)', () => {
  it("does not take Initech's SCIM token on another workspace", async () => {
    expect((await scim('GET', 'Users', { on: tenantHost(standard.slug) })).status).toBe(404);
  });

  it("takes no person's token on /scim, and no SCIM token on /api", async () => {
    expect((await scim('GET', 'Users', { token: owner })).status).toBe(401);
    expect((await scim('GET', 'Users', { token: standard.ownerToken })).status).toBe(401);
    expect((await api(host, 'GET', '/api/me', { token: scimToken })).status).toBe(401);
  });

  it('puts SCIM people in Initech only, signing in with the default role', async () => {
    const person = await scimPerson();
    const inPlatform = await adminGet(`/users?username=${encodeURIComponent(person.userName)}&exact=true`);
    expect(inPlatform.body).toEqual([]);
    const token = await signIn(person.userName, person.password);
    const me = await api<{ role: string }>(host, 'GET', '/api/me', { token });
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('member');
  });

  it('stops a password-only sign-in at the set-up step when two-step is required', async () => {
    const person = await scimPerson();
    const res = await api(host, 'PUT', '/api/security', {
      token: owner,
      body: { ...before, twoStep: 'required' },
    });
    expect(res.status).toBe(200);
    await expect(signIn(person.userName, person.password)).rejects.toThrow(
      /required-action\?execution=CONFIGURE_TOTP/,
    );
    await api(host, 'PUT', '/api/security', { token: owner, body: before });
  });

  it('refuses a revoked token', async () => {
    const res = await api<{ token: string }>(host, 'POST', '/api/scim/token', {
      token: owner,
      body: { expiresInDays: 90 },
    });
    const old = scimToken;
    scimToken = res.body.token;
    expect((await scim('GET', 'Users', { token: old })).status).toBe(401);
    expect((await scim('GET', 'Users')).status).toBe(200);
  });
});

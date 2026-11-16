import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authorizeUrl, Browser, signInWithBrowser } from './helpers/browser-flow.js';
import { BASE_DOMAIN, env, HTTP_PORT, KEYCLOAK_URL } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

// Phase 4 (ADR-0011): customer apps in the seeded enterprise demo, Initech.
const INITECH = { slug: 'initech', realm: 'ent-initech', owner: 'owner@initech.test' };
// A redirect for an app that never runs: the test stops at Keycloak's answer.
const APP_REDIRECT = 'http://127.0.0.1:4000/callback';
const port = HTTP_PORT === 80 ? '' : `:${String(HTTP_PORT)}`;
const webRedirect = `http://${INITECH.slug}.${BASE_DOMAIN}${port}/`;

interface Registered {
  app: { id: string; clientId: string; connection: { issuer: string } };
  clientSecret?: string;
}

let owner: string;
let standard: TestTenant;
const made: string[] = [];

const apps = (token: string, method: string, path = '', body?: unknown, host = tenantHost(INITECH.slug)) =>
  api<Registered>(host, method, `/api/apps${path}`, { token, ...(body === undefined ? {} : { body }) });

async function register(body: Record<string, unknown>): Promise<Registered> {
  const res = await apps(owner, 'POST', '', body);
  if (res.status !== 201) throw new Error(`register: ${String(res.status)} ${JSON.stringify(res.body)}`);
  made.push(res.body.app.id);
  return res.body;
}

beforeAll(async () => {
  owner = await signInWithBrowser({
    realm: INITECH.realm,
    clientId: 'tenantry-web',
    redirectUri: webRedirect,
    username: INITECH.owner,
    password: env('SEED_PASSWORD'),
  });
  standard = await signupTenant('apps');
});

afterAll(async () => {
  for (const id of made) await apps(owner, 'DELETE', `/${id}`);
});

describe('guarantee: customer apps (Phase 4)', () => {
  it.each([
    'https://*.initech.test/callback',
    'http://hr.initech.test/callback',
    'http://localhost:4000/callback',
  ])('refuses the redirect URI %s', async (uri) => {
    const res = await apps(owner, 'POST', '', { name: 'Bad', type: 'web', redirectUris: [uri] });
    expect(res.status).toBe(422);
  });

  it("refuses another tenant's admin, both ways", async () => {
    const body = { name: 'Nope', type: 'm2m' };
    expect((await apps(standard.ownerToken, 'POST', '', body)).status).toBe(401);
    expect((await apps(owner, 'POST', '', body, tenantHost(standard.slug))).status).toBe(401);
    const mine = await register({ name: 'Mine', type: 'm2m' });
    const elsewhere = await apps(
      standard.ownerToken,
      'GET',
      `/${mine.app.id}`,
      undefined,
      tenantHost(standard.slug),
    );
    expect(elsewhere.status).toBe(404);
  });

  it("does not let a user of another tenant sign in to Initech's app", async () => {
    const hr = await register({ name: 'Iso HR', type: 'web', redirectUris: [APP_REDIRECT] });
    const browser = new Browser(APP_REDIRECT);
    const login = await browser.open(
      authorizeUrl({
        realm: INITECH.realm,
        clientId: hr.app.clientId,
        redirectUri: APP_REDIRECT,
        challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      }),
    );
    const done = await browser.submit(login, {
      username: standard.owner.email,
      password: standard.owner.password,
    });
    expect(done.url.startsWith(APP_REDIRECT)).toBe(false);
    expect(done.html).toMatch(/Invalid username or password/i);
  });

  it("refuses a customer app's own token on Tenantry's API", async () => {
    const sync = await register({ name: 'Iso sync', type: 'm2m' });
    const res = await fetch(`${KEYCLOAK_URL}/realms/${INITECH.realm}/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: sync.app.clientId,
        client_secret: sync.clientSecret ?? '',
      }),
    });
    expect(res.status).toBe(200);
    const { access_token } = (await res.json()) as { access_token: string };
    const me = await api(tenantHost(INITECH.slug), 'GET', '/api/me', { token: access_token });
    expect(me.status).toBe(401);
  });
});


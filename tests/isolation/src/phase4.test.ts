import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, signInWithBrowser } from './helpers/browser-flow.js';
import { BASE_DOMAIN, env, HTTP_PORT, KEYCLOAK_URL } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

// Phase 4 (ADR-0011): customer apps in the seeded enterprise demo, Initech.
const INITECH = { slug: 'initech', realm: 'ent-initech', owner: 'owner@initech.test' };
const EXAMPLE = { url: 'http://127.0.0.1:4000', redirect: 'http://127.0.0.1:4000/callback' };
const EXAMPLE_DIR = fileURLToPath(new URL('../../../examples/customer-app/', import.meta.url));
const port = HTTP_PORT === 80 ? '' : `:${String(HTTP_PORT)}`;
const webRedirect = `http://${INITECH.slug}.${BASE_DOMAIN}${port}/`;
const PUBLIC_AUTH = new URL(env('TENANTRY_AUTH_URL')).origin;
const oidc = `${PUBLIC_AUTH}/realms/${INITECH.realm}/protocol/openid-connect`;

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
    const hr = await register({ name: 'Iso HR', type: 'web', redirectUris: [EXAMPLE.redirect] });
    const browser = new Browser(EXAMPLE.redirect);
    const login = await browser.open(
      `${oidc}/auth?${new URLSearchParams({
        client_id: hr.app.clientId,
        redirect_uri: EXAMPLE.redirect,
        response_type: 'code',
        scope: 'openid',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      }).toString()}`,
    );
    const done = await browser.submit(login, {
      username: standard.owner.email,
      password: standard.owner.password,
    });
    expect(done.url.startsWith(EXAMPLE.redirect)).toBe(false);
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

describe('single sign-on with the example customer app', () => {
  let child: ChildProcess | null = null;

  afterAll(() => {
    child?.kill();
  });

  it('signs in without a login page after Tenantry, and its sign-out ends the Tenantry session', async () => {
    const hr = await register({
      name: 'Iso example',
      type: 'web',
      redirectUris: [EXAMPLE.redirect],
      postLogoutRedirectUris: [`${EXAMPLE.url}/`],
    });
    child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      cwd: EXAMPLE_DIR,
      env: {
        ...process.env,
        ISSUER: hr.app.connection.issuer,
        CLIENT_ID: hr.app.clientId,
        CLIENT_SECRET: hr.clientSecret ?? '',
        AUTH_INTERNAL_URL: KEYCLOAK_URL,
      },
      stdio: 'ignore',
    });
    for (let i = 0; i < 60; i++) {
      if (
        await fetch(EXAMPLE.url).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 500));
    }

    const browser = new Browser(webRedirect);
    await signInWithBrowser({
      realm: INITECH.realm,
      clientId: 'tenantry-web',
      redirectUri: webRedirect,
      username: INITECH.owner,
      password: env('SEED_PASSWORD'),
      browser,
    });
    browser.stopAt = 'http://stop.invalid/';
    const home = await browser.open(`${EXAMPLE.url}/login`);
    expect(home.url).toBe(`${EXAMPLE.url}/`);
    expect(home.html).toContain(`Signed in as ${INITECH.owner}`);

    await browser.open(`${EXAMPLE.url}/logout`);
    browser.stopAt = webRedirect;
    const again = await browser.open(
      `${oidc}/auth?${new URLSearchParams({
        client_id: 'tenantry-web',
        redirect_uri: webRedirect,
        response_type: 'code',
        scope: 'openid',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      }).toString()}`,
    );
    expect(again.url.startsWith(webRedirect)).toBe(false);
    expect(again.status).toBe(200);
  }, 60000);
});

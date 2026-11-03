import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { env, KEYCLOAK_URL } from './helpers/env.js';
import { api, tenantHost } from './helpers/http.js';
import { adminGet, createUser, tokenFor } from './helpers/keycloak.js';
import { signupTenant, type TestTenant } from './helpers/tenants.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TOKEN_URL = `${KEYCLOAK_URL}/realms/platform/protocol/openid-connect`;
const client = () => ({
  client_id: 'tenantry-isolation-tests',
  client_secret: env('TENANTRY_ISOLATION_CLIENT_SECRET'),
});
const portalHost = (slug: string) => tenantHost(`${slug}.portal`);

// Runs an operator command as a person would; returns its exit code.
function ops(...args: string[]): number {
  try {
    execFileSync('pnpm', ['--filter', '@tenantry/ops', '--silent', 'run', 'ops', ...args], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    return 0;
  } catch (err) {
    return (err as { status?: number }).status ?? 1;
  }
}

let a: TestTenant;
let b: TestTenant;

beforeAll(async () => {
  a = await signupTenant('p2a');
  b = await signupTenant('p2b');
});

describe('guarantee: logout in one app ends the session in the other', () => {
  it('refuses the refresh token of a session that was logged out', async () => {
    const user = await createUser('logout');
    const signIn = await fetch(`${TOKEN_URL}/token`, {
      method: 'POST',
      body: new URLSearchParams({
        ...client(),
        grant_type: 'password',
        username: user.username,
        password: user.password,
        scope: 'openid',
      }),
    });
    const { refresh_token } = (await signIn.json()) as { refresh_token: string };
    // The other app holds a refresh token from the same session; one app signs out.
    const logout = await fetch(`${TOKEN_URL}/logout`, {
      method: 'POST',
      body: new URLSearchParams({ ...client(), refresh_token }),
    });
    expect(logout.status).toBe(204);
    const refresh = await fetch(`${TOKEN_URL}/token`, {
      method: 'POST',
      body: new URLSearchParams({ ...client(), grant_type: 'refresh_token', refresh_token }),
    });
    expect(refresh.status).toBe(400);
    expect(((await refresh.json()) as { error: string }).error).toBe('invalid_grant');
  });
});

describe('guarantee: a domain link without a verified DNS record is refused', () => {
  it('exits non-zero and creates nothing in Keycloak', async () => {
    const alias = `corp-${a.slug}`;
    expect(ops('domain', 'claim', '--tenant', a.slug, '--domain', `${a.slug}.test`)).toBe(0);
    expect(
      ops(
        'idp',
        'link',
        '--tenant',
        a.slug,
        '--domain',
        `${a.slug}.test`,
        '--alias',
        alias,
        '--issuer',
        `${env('TENANTRY_AUTH_URL')}/realms/corp-demo`,
        '--client-id',
        'tenantry-platform',
        '--client-secret-env',
        'CORP_DEMO_CLIENT_SECRET',
      ),
    ).toBe(1);
    expect((await adminGet(`/identity-provider/instances/${alias}`)).status).toBe(404);
  });
});

describe('branding and the portal host keep tenants apart', () => {
  it("refuses tenant A's owner changing tenant B's branding", async () => {
    const before = await api<{ primaryColor: string | null }>(
      tenantHost(b.slug),
      'GET',
      `/api/tenants/${b.slug}/branding`,
    );
    const res = await api(tenantHost(b.slug), 'PUT', '/api/branding', {
      token: a.ownerToken,
      body: { primaryColor: '#198038' },
    });
    expect(res.status).toBe(403);
    const after = await api<{ primaryColor: string | null }>(
      tenantHost(b.slug),
      'GET',
      `/api/tenants/${b.slug}/branding`,
    );
    expect(after.body.primaryColor).toBe(before.body.primaryColor);
  });

  it("refuses tenant A's token on tenant B's portal host", async () => {
    expect((await api(portalHost(b.slug), 'GET', '/api/me', { token: a.ownerToken })).status).toBe(403);
    expect((await api(portalHost(a.slug), 'GET', '/api/me', { token: a.ownerToken })).status).toBe(200);
  });
});

describe('the seeded demo (pnpm seed)', () => {
  it('lets pat switch between acme and globex', async () => {
    const pat = { username: 'pat@example.test', password: env('SEED_PASSWORD') };
    const token = await tokenFor({ ...pat, kcUserId: '', email: pat.username }, 'acme');
    const res = await api<{ slug: string }[]>(tenantHost('acme'), 'GET', '/api/me/workspaces', { token });
    expect(res.status).toBe(200);
    expect(res.body.map((w) => w.slug)).toEqual(expect.arrayContaining(['acme', 'globex']));
  });
});

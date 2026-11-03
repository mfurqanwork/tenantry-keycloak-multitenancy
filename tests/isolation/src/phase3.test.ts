import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Browser, signInWithBrowser } from './helpers/browser-flow.js';
import { BASE_DOMAIN, env, HTTP_PORT, KEYCLOAK_URL } from './helpers/env.js';
import { api, apexHost, tenantHost } from './helpers/http.js';
import { createUser, grantClientRole, tokenFor } from './helpers/keycloak.js';
import { newSlug } from './helpers/tenants.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
// The seeded enterprise demo (pnpm seed) and the seeded Standard workspace with company login.
const INITECH = { slug: 'initech', realm: 'ent-initech', owner: 'owner@initech.test' };
const ACME = 'acme';
const port = HTTP_PORT === 80 ? '' : `:${String(HTTP_PORT)}`;
const webRedirect = (slug: string) => `http://${slug}.${BASE_DOMAIN}${port}/`;

// Runs an operator command as a person would; returns its exit code and what it printed.
function ops(...args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync('pnpm', ['--filter', '@tenantry/ops', '--silent', 'run', 'ops', ...args], {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const me = (host: string, token: string) =>
  api<{ role: string | null; tenant: { slug: string } }>(host, 'GET', '/api/me', { token });

let initechOwner: string;
let other: { slug: string; realm: string; token: string };

beforeAll(async () => {
  initechOwner = await signInWithBrowser({
    realm: INITECH.realm,
    clientId: 'tenantry-web',
    redirectUri: webRedirect(INITECH.slug),
    username: INITECH.owner,
    password: env('SEED_PASSWORD'),
  });
  // A second enterprise tenant, provisioned the way an operator does it.
  const slug = newSlug('ent');
  const made = ops(
    'enterprise',
    'provision',
    '--slug',
    slug,
    '--name',
    'Isolation Other',
    '--admin-email',
    `owner@${slug}.test`,
  );
  if (made.code !== 0) throw new Error(`provision ${slug}: ${made.out}`);
  const realm = `ent-${slug}`;
  const person = await createUser('ent-other', { realm });
  await grantClientRole(realm, person.kcUserId, 'tenantry-api', 'member');
  const token = await signInWithBrowser({
    realm,
    clientId: 'tenantry-web',
    redirectUri: webRedirect(slug),
    username: person.username,
    password: person.password,
  });
  other = { slug, realm, token };
}, 180_000);

describe('guarantee: an enterprise tenant accepts only its own realm’s tokens', () => {
  it("accepts the Initech owner's token on Initech, as owner", async () => {
    const res = await me(tenantHost(INITECH.slug), initechOwner);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'owner', tenant: { slug: INITECH.slug } });
  });

  it('refuses a platform realm token on Initech', async () => {
    const person = await createUser('platform-on-ent');
    expect((await me(tenantHost(INITECH.slug), await tokenFor(person))).status).toBe(401);
  });

  it("refuses another enterprise realm's token on Initech", async () => {
    expect((await me(tenantHost(other.slug), other.token)).status).toBe(200);
    expect((await me(tenantHost(INITECH.slug), other.token)).status).toBe(401);
  });

  it('refuses an Initech token that was not issued for the Tenantry API', async () => {
    // The owner signed in to Keycloak's own account console: right issuer and person, wrong audience.
    const accountToken = await signInWithBrowser({
      realm: INITECH.realm,
      clientId: 'account-console',
      redirectUri: `${env('TENANTRY_AUTH_URL')}/realms/${INITECH.realm}/account/`,
      username: INITECH.owner,
      password: env('SEED_PASSWORD'),
    });
    expect((await me(tenantHost(INITECH.slug), accountToken)).status).toBe(401);
  });

  it("refuses the Initech owner's token on a Standard workspace", async () => {
    expect((await me(tenantHost(ACME), initechOwner)).status).toBe(401);
  });

  it('refuses the password grant in an enterprise realm', async () => {
    const res = await fetch(`${KEYCLOAK_URL}/realms/${INITECH.realm}/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'tenantry-web',
        username: INITECH.owner,
        password: env('SEED_PASSWORD'),
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('guarantee: enterprise realms stay on their template', () => {
  it('reports no differences on a freshly provisioned realm', () => {
    const run = ops('enterprise', 'upgrade', '--tenant', other.slug, '--dry-run');
    expect(run.code).toBe(0);
    expect(run.out).toContain(`${other.realm}: up to date`);
  });
});

describe("guarantee: a company login only admits the organization's own domains", () => {
  it('stops a company account whose email is outside acme.test', async () => {
    // A corp-demo account that asserts an address Acme never verified.
    const outsider = await createUser('outsider', {
      realm: 'corp-demo',
      email: `${newSlug('pat')}@example.test`,
    });
    const browser = new Browser(`http://${apexHost}${port}/`);
    const start = await browser.open(
      `${env('TENANTRY_AUTH_URL')}/realms/platform/protocol/openid-connect/auth?${new URLSearchParams({
        client_id: 'tenantry-web',
        redirect_uri: `http://${apexHost}${port}/`,
        response_type: 'code',
        scope: 'openid',
        code_challenge: 'x'.repeat(43),
        code_challenge_method: 'S256',
        kc_idp_hint: 'acme-corp',
      }).toString()}`,
    );
    const review = await browser.submit(start, { username: outsider.username, password: outsider.password });
    // First sign-in through a company: Keycloak shows the asserted profile, then checks its domain.
    const end = await browser.submit(review, {
      username: outsider.username,
      email: outsider.email,
      firstName: 'Iso',
      lastName: 'outsider',
    });
    expect(end.url.startsWith(`http://${apexHost}${port}/`)).toBe(false);
    expect(end.html).toContain('Email domain does not match any domain from the organization');
  });
});

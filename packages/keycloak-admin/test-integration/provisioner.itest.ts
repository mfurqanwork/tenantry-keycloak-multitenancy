import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { createHttpRealmProvisioner } from '../src/realms/provisioner.js';
import { loadProductClients, loadRealmTemplate, TEMPLATE_VERSION } from '../src/realms/templates.js';

function env(key: string): string {
  const file = new URL('../../../.env', import.meta.url);
  let value = process.env[key];
  if (!value && existsSync(file)) {
    value = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'))?.[1]?.trim();
  }
  if (!value) throw new Error(`${key} is not set: copy .env.example to .env`);
  return value;
}

const baseUrl = env('TENANTRY_AUTH_INTERNAL_URL');
const realm = `ent-it${randomBytes(3).toString('hex')}`;
const vars = {
  displayName: 'Integration Co',
  webOrigin: `http://${realm}.tenantry.localhost:8080`,
  portalOrigin: `http://${realm}.portal.tenantry.localhost:8080`,
  smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
  allowHttpRedirects: true,
};
const template = loadRealmTemplate(TEMPLATE_VERSION, vars);
const clients = loadProductClients(vars);
const adminEmail = `owner-${realm}@example.test`;
const secret = randomBytes(32).toString('base64url');
const provisioner = createHttpRealmProvisioner({
  baseUrl,
  clientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
  clientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
});

// The bootstrap admin checks results and cleans up; the provisioner never uses it.
async function bootstrap(method: string, path: string, body?: unknown): Promise<Response> {
  const token = (await (
    await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
        password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
      }),
    })
  ).json()) as { access_token: string };
  return fetch(`${baseUrl}/admin/realms${path}`, {
    method,
    headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// Mailpit through Caddy, as the browser reaches it.
function mailsTo(address: string): Promise<number> {
  const port = Number(env('TENANTRY_HTTP_PORT'));
  return new Promise((resolve, reject) => {
    request(
      {
        host: '127.0.0.1',
        port,
        path: `/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        headers: { host: `mail.tenantry.localhost:${String(port)}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (c: Buffer) => (raw += c.toString()));
        res.on('end', () => {
          resolve((JSON.parse(raw) as { messages_count: number }).messages_count);
        });
      },
    )
      .on('error', reject)
      .end();
  });
}

afterAll(async () => {
  await bootstrap('DELETE', `/${realm}`);
});

describe('realm provisioner (Keycloak)', () => {
  it('creates the realm once', async () => {
    expect(await provisioner.ensureRealm(realm)).toEqual({ created: true });
    expect(await provisioner.ensureRealm(realm)).toEqual({ created: false });
  });

  it('applies the template, the product clients and the backend secret, twice without change', async () => {
    for (let run = 0; run < 2; run++) {
      await provisioner.applyTemplate(realm, template);
      await provisioner.ensureClients(realm, clients);
      await provisioner.setBackendSecret(realm, secret);
    }
    expect(await provisioner.diff(realm, template, clients)).toEqual([]);
    const list = (await (await bootstrap('GET', `/${realm}/clients`)).json()) as { clientId: string }[];
    const ours = list.map((c) => c.clientId).filter((id) => id.startsWith('tenantry-'));
    expect(ours.sort()).toEqual(['tenantry-api', 'tenantry-backend', 'tenantry-portal', 'tenantry-web']);
  });

  it('creates the first admin once, as owner, with a set-password email', async () => {
    const first = await provisioner.ensureFirstAdmin(realm, adminEmail, vars.webOrigin);
    expect(first.created).toBe(true);
    const again = await provisioner.ensureFirstAdmin(realm, adminEmail, vars.webOrigin);
    expect(again).toEqual({ created: false, kcUserId: first.kcUserId });
    const [api] = (await (await bootstrap('GET', `/${realm}/clients?clientId=tenantry-api`)).json()) as {
      id: string;
    }[];
    const roles = (await (
      await bootstrap('GET', `/${realm}/users/${first.kcUserId}/role-mappings/clients/${api?.id ?? ''}`)
    ).json()) as { name: string }[];
    expect(roles.map((r) => r.name)).toEqual(['owner']);
    expect(await mailsTo(adminEmail)).toBe(1);
  });

  it('passes its smoke test with the backend secret', async () => {
    await expect(provisioner.smokeTest(realm, secret)).resolves.toBeUndefined();
    await expect(provisioner.smokeTest(realm, 'wrong')).rejects.toThrow();
  });

  it('reports drift without changing anything', async () => {
    await bootstrap('PUT', `/${realm}`, { accessTokenLifespan: 900 });
    expect(await provisioner.diff(realm, template, clients)).toEqual([
      { path: 'realm.accessTokenLifespan', live: 900, template: 300 },
    ]);
    const live = (await (await bootstrap('GET', `/${realm}`)).json()) as { accessTokenLifespan: number };
    expect(live.accessTokenLifespan).toBe(900);
    await provisioner.applyTemplate(realm, template);
    expect(await provisioner.diff(realm, template, clients)).toEqual([]);
  });
});

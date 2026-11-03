import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createHttpIdentityDirectory } from '../src/http-identity-directory.js';
import { runIdentityDirectoryContract } from '../src/testing/contract.js';

// Same .env as the stack; real environment variables win (CI).
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

// Test users are made with the bootstrap admin, which the API itself never uses.
async function adminToken(): Promise<string> {
  const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
      password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
    }),
  });
  if (!res.ok) throw new Error(`admin token: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

runIdentityDirectoryContract('Keycloak over HTTP', async () => {
  const token = await adminToken();
  const users = `${baseUrl}/admin/realms/platform/users`;
  const created: string[] = [];
  return {
    dir: createHttpIdentityDirectory({
      baseUrl,
      realm: 'platform',
      clientId: env('KEYCLOAK_BACKEND_CLIENT_ID'),
      clientSecret: env('KEYCLOAK_BACKEND_CLIENT_SECRET'),
      webClientId: 'tenantry-web',
      portalClientId: 'tenantry-portal',
    }),
    async newUser() {
      const name = `contract-${randomUUID().slice(0, 8)}`;
      const res = await fetch(users, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, email: `${name}@example.com`, enabled: true }),
      });
      const id = res.headers.get('location')?.split('/').pop();
      if (res.status !== 201 || !id) throw new Error(`create user: ${res.status}`);
      created.push(id);
      return id;
    },
    async redirectUris(app) {
      const clientId = app === 'web' ? 'tenantry-web' : 'tenantry-portal';
      const res = await fetch(`${baseUrl}/admin/realms/platform/clients?clientId=${clientId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const [found] = (await res.json()) as { redirectUris?: string[] }[];
      return found?.redirectUris ?? [];
    },
    async cleanup() {
      for (const id of created) {
        await fetch(`${users}/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
      }
    },
  };
});

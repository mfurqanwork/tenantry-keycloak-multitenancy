import { randomBytes, randomUUID } from 'node:crypto';
import { env, KEYCLOAK_URL } from './env.js';

export interface TestUser {
  kcUserId: string;
  username: string;
  email: string;
  password: string;
}

const ADMIN = `${KEYCLOAK_URL}/admin/realms/platform`;
const adminOf = (realm: string) => `${KEYCLOAK_URL}/admin/realms/${realm}`;

async function form(url: string, fields: Record<string, string>): Promise<{ access_token: string }> {
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(fields) });
  if (!res.ok) throw new Error(`${url}: ${String(res.status)} ${await res.text()}`);
  return (await res.json()) as { access_token: string };
}

// The suite sets up users with the bootstrap admin; the API never uses this account.
async function adminToken(): Promise<string> {
  const { access_token } = await form(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    grant_type: 'password',
    client_id: 'admin-cli',
    username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
    password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
  });
  return access_token;
}

async function admin(method: string, path: string, body?: unknown, realm = 'platform'): Promise<Response> {
  const res = await fetch(`${adminOf(realm)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await adminToken()}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${String(res.status)} ${await res.text()}`);
  return res;
}

// A read with the bootstrap admin, for checking what is (or is not) in Keycloak.
export async function adminGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${ADMIN}${path}`, { headers: { authorization: `Bearer ${await adminToken()}` } });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : undefined };
}

// A person in any realm (platform by default); `email` overrides the generated address.
export async function createUser(
  label: string,
  o: { realm?: string; email?: string } = {},
): Promise<TestUser> {
  const username = `iso-${label}-${randomUUID().slice(0, 8)}`;
  const email = o.email ?? `${username}@example.com`;
  const password = `Iso-${randomBytes(12).toString('base64url')}`;
  const res = await admin(
    'POST',
    '/users',
    {
      username,
      email,
      emailVerified: true,
      enabled: true,
      firstName: 'Iso',
      lastName: label,
      credentials: [{ type: 'password', value: password, temporary: false }],
    },
    o.realm,
  );
  const kcUserId = res.headers.get('location')?.split('/').pop();
  if (!kcUserId) throw new Error('no user id in Location');
  return { kcUserId, username, email, password };
}

// Signs in through the test-only password-grant client; scope picks the organization block.
export async function tokenFor(user: TestUser, slug?: string): Promise<string> {
  const { access_token } = await form(`${KEYCLOAK_URL}/realms/platform/protocol/openid-connect/token`, {
    grant_type: 'password',
    client_id: 'tenantry-isolation-tests',
    client_secret: env('TENANTRY_ISOLATION_CLIENT_SECRET'),
    username: user.username,
    password: user.password,
    scope: slug ? `openid organization:${slug}` : 'openid',
  });
  return access_token;
}

// Puts a user straight into a tenant's organization and role group, as an accepted invite would.
export async function addToTenant(
  user: TestUser,
  slug: string,
  group: 'owners' | 'admins' | 'members',
): Promise<void> {
  // Keycloak's search matches organization names, not aliases; list and match the alias here.
  const orgs = (await (await admin('GET', '/organizations?first=0&max=10000')).json()) as {
    id: string;
    alias: string;
  }[];
  const org = orgs.find((o) => o.alias === slug);
  if (!org) throw new Error(`organization ${slug} not found`);
  await admin('POST', `/organizations/${org.id}/members`, user.kcUserId);
  const groups = (await (await admin('GET', `/organizations/${org.id}/groups`)).json()) as {
    id: string;
    name: string;
  }[];
  const target = groups.find((g) => g.name === group);
  if (!target) throw new Error(`group ${group} not found`);
  await admin('PUT', `/organizations/${org.id}/groups/${target.id}/members/${user.kcUserId}`);
}

// Gives a person in an enterprise realm one of a client's roles, as an accepted invite would.
export async function grantClientRole(
  realm: string,
  kcUserId: string,
  clientId: string,
  role: string,
): Promise<void> {
  const [client] = (await (
    await admin('GET', `/clients?clientId=${encodeURIComponent(clientId)}`, undefined, realm)
  ).json()) as { id: string }[];
  if (!client) throw new Error(`client ${clientId} not found in ${realm}`);
  const rep = (await (
    await admin('GET', `/clients/${client.id}/roles/${role}`, undefined, realm)
  ).json()) as unknown;
  await admin('POST', `/users/${kcUserId}/role-mappings/clients/${client.id}`, [rep], realm);
}

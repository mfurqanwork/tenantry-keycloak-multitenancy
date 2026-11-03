import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createHttpRealmProvisioner, type RealmProvisioner } from '../src/realms/provisioner.js';
import {
  loadProductClients,
  loadRealmTemplate,
  TEMPLATE_VERSION,
  type TemplateVars,
} from '../src/realms/templates.js';

// What the integration tests share: the stack's settings, the bootstrap admin, and throwaway realms.

// Same .env as the stack; real environment variables win (CI).
export function env(key: string): string {
  const file = new URL('../../../.env', import.meta.url);
  let value = process.env[key];
  if (!value && existsSync(file)) {
    value = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'))?.[1]?.trim();
  }
  if (!value) throw new Error(`${key} is not set: copy .env.example to .env`);
  return value;
}

export const baseUrl = env('TENANTRY_AUTH_INTERNAL_URL');

// The bootstrap admin sets up and checks results; the code under test never uses it.
export async function adminToken(): Promise<string> {
  const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
      password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
    }),
  });
  if (!res.ok) throw new Error(`admin token: ${String(res.status)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

// An admin REST call as the bootstrap admin, path under /admin/realms.
export async function bootstrap(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}/admin/realms${path}`, {
    method,
    headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function testRealmVars(realm: string, displayName: string): TemplateVars {
  return {
    displayName,
    webOrigin: `http://${realm}.tenantry.localhost:8080`,
    portalOrigin: `http://${realm}.portal.tenantry.localhost:8080`,
    smtp: { host: 'mailpit', port: '1025', from: 'no-reply@tenantry.localhost' },
    allowHttpRedirects: true,
  };
}

// The create-realm-only account the API provisions with (ADR-0010).
export function testProvisioner(): RealmProvisioner {
  return createHttpRealmProvisioner({
    baseUrl,
    clientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
    clientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
  });
}

// A new enterprise realm built like a real one, with its backend secret; delete it when done.
export async function provisionTestRealm(
  prefix: string,
  displayName: string,
): Promise<{ realm: string; secret: string }> {
  const realm = `ent-${prefix}${randomBytes(3).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  const vars = testRealmVars(realm, displayName);
  const provisioner = testProvisioner();
  await provisioner.ensureRealm(realm);
  await provisioner.applyTemplate(realm, loadRealmTemplate(TEMPLATE_VERSION, vars));
  await provisioner.ensureClients(realm, loadProductClients(vars));
  await provisioner.setBackendSecret(realm, secret);
  return { realm, secret };
}

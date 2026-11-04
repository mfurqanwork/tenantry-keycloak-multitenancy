import { createHash, randomBytes } from 'node:crypto';
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

// A person signing in with only a password through the realm's browser flow (authorization code with
// PKCE). True when Keycloak sends them back to the app; false when it asks for something more.
export async function passwordSignIn(o: {
  realm: string;
  clientId: string;
  redirectUri: string;
  username: string;
  password: string;
}): Promise<{ toApp: boolean; status: number }> {
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const keep = (res: Response) => {
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const challenge = createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url');
  const auth = `${baseUrl}/realms/${o.realm}/protocol/openid-connect/auth?${new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: 'openid',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()}`;
  const page = await fetch(auth, { redirect: 'manual' });
  keep(page);
  const html = await page.text();
  const action = (
    /"loginAction"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
    /<form[^>]*\saction="([^"]+)"/.exec(html)?.[1] ??
    ''
  )
    .replace(/&amp;/g, '&')
    .replace(new URL(env('TENANTRY_AUTH_URL')).origin, baseUrl);
  const res = await fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: o.username, password: o.password }),
  });
  return { toApp: (res.headers.get('location') ?? '').startsWith(o.redirectUri), status: res.status };
}

// A person signing in to their realm's admin console (the security-admin-console client, as the
// console itself does), returning the console's access token.
export async function consoleSignIn(o: {
  realm: string;
  username: string;
  password: string;
}): Promise<string> {
  const publicAuth = new URL(env('TENANTRY_AUTH_URL')).origin;
  const local = (u: string) => (u.startsWith(publicAuth) ? baseUrl + u.slice(publicAuth.length) : u);
  const redirectUri = `${publicAuth}/admin/${o.realm}/console/`;
  const jar = new Map<string, string>();
  const keep = (res: Response) => {
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const page = await fetch(
    `${baseUrl}/realms/${o.realm}/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: 'security-admin-console',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()}`,
    { redirect: 'manual' },
  );
  keep(page);
  const html = await page.text();
  const found =
    /"loginAction"\s*:\s*"([^"]+)"/.exec(html)?.[1] ?? /<form[^>]*\saction="([^"]+)"/.exec(html)?.[1] ?? '';
  const res = await fetch(local(found.replace(/&amp;/g, '&')), {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: o.username, password: o.password }),
  });
  const code = new URL(res.headers.get('location') ?? 'http://x/').searchParams.get('code');
  if (!code) throw new Error(`console sign-in to ${o.realm} did not finish: ${String(res.status)}`);
  const tok = await fetch(`${baseUrl}/realms/${o.realm}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'security-admin-console',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  return ((await tok.json()) as { access_token: string }).access_token;
}

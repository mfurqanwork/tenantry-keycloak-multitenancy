import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpIdentityDirectory } from '../src/http-identity-directory.js';
import { BRIDGE_ALIAS, createRealmBridge } from '../src/realms/bridge.js';
import { createRealmIdps } from '../src/realms/idp-copy.js';
import { adminToken, baseUrl, bootstrap, env, passwordSignIn, provisionTestRealm } from './stack.js';

// The bridge out of the shared realm (ADR-0025), against real Keycloak: the platform realm is the source.
const publicAuthUrl = new URL(env('TENANTRY_AUTH_URL')).origin;
const provisioner = {
  provisionerClientId: env('KEYCLOAK_PROVISIONER_CLIENT_ID'),
  provisionerClientSecret: env('KEYCLOAK_PROVISIONER_CLIENT_SECRET'),
};
const platform = createHttpIdentityDirectory({
  baseUrl,
  realm: 'platform',
  clientId: env('KEYCLOAK_BACKEND_CLIENT_ID'),
  clientSecret: env('KEYCLOAK_BACKEND_CLIENT_SECRET'),
  webClientId: 'tenantry-web',
  portalClientId: 'tenantry-portal',
});

describe('bridge from the shared realm', () => {
  let realm: string;
  let slug: string;
  const PW = `Pw-${randomBytes(9).toString('base64url')}`;
  const platformUsers: string[] = [];
  const redirectUri = 'http://127.0.0.1:9/cb';

  async function platformUser(): Promise<{ id: string; username: string }> {
    const username = `bridge-${randomUUID().slice(0, 8)}`;
    const res = await fetch(`${baseUrl}/admin/realms/platform/users`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        username,
        email: `${username}@example.com`,
        emailVerified: true,
        enabled: true,
        firstName: 'Bridge',
        lastName: 'Person',
        credentials: [{ type: 'password', value: PW, temporary: false }],
      }),
    });
    const id = res.headers.get('location')?.split('/').pop() ?? '';
    platformUsers.push(id);
    return { id, username };
  }

  async function realmUser(username: string): Promise<string> {
    const res = await bootstrap('POST', `/${realm}/users`, {
      username,
      email: `${username}@example.com`,
      emailVerified: true,
      enabled: true,
      firstName: 'Bridge',
      lastName: 'Person',
    });
    return res.headers.get('location')?.split('/').pop() ?? '';
  }

  const bridge = () => createRealmBridge({ baseUrl, publicAuthUrl, realm, ...provisioner });
  const idps = () => createRealmIdps({ baseUrl, realm, ...provisioner });
  const signIn = (username: string) =>
    passwordSignIn({
      realm,
      clientId: 'bridge-test-app',
      redirectUri,
      username,
      password: PW,
      via: BRIDGE_ALIAS,
    });

  beforeAll(async () => {
    ({ realm } = await provisionTestRealm('br', 'Bridge'));
    slug = realm.replace(/^ent-/, '');
    const secret = randomBytes(24).toString('base64url');
    await platform.ensureBridgeClient(
      slug,
      `${publicAuthUrl}/realms/${realm}/broker/${BRIDGE_ALIAS}/endpoint`,
      secret,
    );
    await bridge().ensure({ slug, secret });
    await bridge().ensure({ slug, secret });
    await bootstrap('POST', `/${realm}/clients`, {
      clientId: 'bridge-test-app',
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      redirectUris: [redirectUri],
      attributes: { 'pkce.code.challenge.method': 'S256' },
    });
  });
  afterAll(async () => {
    await platform.deleteBridgeClient(slug);
    for (const id of platformUsers) {
      await fetch(`${baseUrl}/admin/realms/platform/users/${id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${await adminToken()}` },
      });
    }
    await bootstrap('DELETE', `/${realm}`);
  });

  it('lets a pre-linked person in with their shared-realm password', async () => {
    const p = await platformUser();
    const id = await realmUser(p.username);
    await idps().link(id, BRIDGE_ALIAS, { userId: p.id, userName: p.username });
    await idps().link(id, BRIDGE_ALIAS, { userId: p.id, userName: p.username });
    expect((await signIn(p.username)).toApp).toBe(true);
  });

  it('refuses someone with a shared-realm account who is not pre-linked, and makes no account', async () => {
    const stranger = await platformUser();
    expect((await signIn(stranger.username)).toApp).toBe(false);
    const found = (await (
      await bootstrap('GET', `/${realm}/users?username=${stranger.username}&exact=true`)
    ).json()) as unknown[];
    expect(found).toEqual([]);
  });

  it('copies a company login with its secret enabled, without one disabled, and sets the secret later', async () => {
    const copy = (alias: string, secret: string | null) =>
      idps().copy(
        {
          alias,
          issuer: `${publicAuthUrl}/realms/corp-demo`,
          clientId: 'tenantry-platform',
          displayName: 'Acme Corp',
          config: {
            authorizationUrl: `${publicAuthUrl}/realms/corp-demo/protocol/openid-connect/auth`,
            tokenUrl: `${publicAuthUrl}/realms/corp-demo/protocol/openid-connect/token`,
            issuer: `${publicAuthUrl}/realms/corp-demo`,
            clientId: 'tenantry-platform',
          },
          mappers: [],
        },
        secret,
      );
    const read = async (alias: string) =>
      (await (await bootstrap('GET', `/${realm}/identity-provider/instances/${alias}`)).json()) as {
        enabled: boolean;
        displayName?: string;
      };
    expect(await copy('with-secret', 'kept-secret')).toEqual({ enabled: true });
    expect(await copy('with-secret', 'kept-secret')).toEqual({ enabled: true });
    expect((await read('with-secret')).enabled).toBe(true);
    // The sign-in button keeps its name in the new realm.
    expect((await read('with-secret')).displayName).toBe('Acme Corp');
    expect(await copy('no-secret', null)).toEqual({ enabled: false });
    expect((await read('no-secret')).enabled).toBe(false);
    await idps().setSecret('no-secret', 'given-later');
    expect((await read('no-secret')).enabled).toBe(true);
  });

  it('removes the bridge, twice without harm', async () => {
    await bridge().remove();
    await bridge().remove();
    const res = await bootstrap('GET', `/${realm}/identity-provider/instances/${BRIDGE_ALIAS}`);
    expect(res.status).toBe(404);
  });
});

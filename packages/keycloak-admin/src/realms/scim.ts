import { randomBytes } from 'node:crypto';
import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';
import type { SecretStore } from '../secrets/secret-store.js';
import { API_CLIENT } from './provisioner.js';
import { MAPPED_GROUPS } from './templates.js';

export const SCIM_CLIENT = 'tenantry-scim';
// Short-lived: the gateway asks again, the directory never sees it (ADR-0024).
const SCIM_TOKEN_SECONDS = 300;

export interface ScimRequest {
  method: string;
  // Under /scim/v2, without a leading slash: "Users", "Users/<id>", "Groups".
  path: string;
  // The raw query string, passed on as it came.
  query: string;
  body?: Buffer;
  contentType?: string;
}

export interface ScimResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

// One enterprise realm's native SCIM (Keycloak 26.8), behind Tenantry's gateway (ADR-0024).
export interface RealmScim {
  enable(): Promise<void>;
  disable(): Promise<void>;
  forward(req: ScimRequest): Promise<ScimResponse>;
  grantRole(kcUserId: string, role: 'member'): Promise<void>;
  isMappedGroup(groupId: string): Promise<boolean>;
  emptyGroup(groupId: string): Promise<void>;
}

export interface RealmScimOptions {
  // Where this process reaches Keycloak.
  baseUrl: string;
  // The realm's issuer as Keycloak publishes it; SCIM tokens carry "<issuer>/scim/v2" as audience.
  publicIssuer: string;
  realm: string;
  // The create-realm account (ADR-0010): it administers the realms it made, SCIM switch included.
  provisionerClientId: string;
  provisionerClientSecret: string;
  secrets: SecretStore;
  fetch?: typeof fetch;
}

export const scimSecretKey = (realm: string) => `${realm}/${SCIM_CLIENT}`;

export function createRealmScim(o: RealmScimOptions): RealmScim {
  const doFetch = o.fetch ?? fetch;
  const adminToken = createAdminTokenSource({
    baseUrl: o.baseUrl,
    realm: 'master',
    clientId: o.provisionerClientId,
    clientSecret: o.provisionerClientSecret,
    fetch: doFetch,
  });
  const admin = `${o.baseUrl}/admin/realms/${encodeURIComponent(o.realm)}`;
  let scimToken: (() => Promise<string>) | null = null;

  async function call(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
    accept: number[] = [],
  ) {
    const res = await doFetch(`${admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await adminToken()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!res.ok && !accept.includes(res.status)) {
      throw new DirectoryError(operation, res.status, await res.text().catch(() => ''));
    }
    return res;
  }
  const json = async <T>(res: Response) => (await res.json()) as T;

  async function clientUuid(operation: string, clientId: string): Promise<string | null> {
    const [found] = await json<{ id: string }[]>(
      await call(operation, 'GET', `/clients?clientId=${encodeURIComponent(clientId)}`),
    );
    return found?.id ?? null;
  }

  async function ensureScimClient(): Promise<string> {
    let secret = await o.secrets.get(scimSecretKey(o.realm));
    if (!secret) {
      secret = randomBytes(32).toString('base64url');
      await o.secrets.put(scimSecretKey(o.realm), secret);
    }
    let id = await clientUuid('enableScim', SCIM_CLIENT);
    const representation = {
      clientId: SCIM_CLIENT,
      name: 'Tenantry SCIM gateway',
      enabled: true,
      publicClient: false,
      secret,
      serviceAccountsEnabled: true,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      fullScopeAllowed: false,
      attributes: { 'access.token.lifespan': String(SCIM_TOKEN_SECONDS) },
      protocolMappers: [
        {
          name: 'scim-audience',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: { 'included.custom.audience': `${o.publicIssuer}/scim/v2`, 'access.token.claim': 'true' },
        },
      ],
    };
    if (!id) {
      await call('enableScim', 'POST', '/clients', representation);
      id = await clientUuid('enableScim', SCIM_CLIENT);
      if (!id) throw new DirectoryError('enableScim', 404, `${SCIM_CLIENT} missing after create`);
    } else {
      const existing = await json<Record<string, unknown>>(await call('enableScim', 'GET', `/clients/${id}`));
      await call('enableScim', 'PUT', `/clients/${id}`, { ...existing, secret, enabled: true });
    }
    // The service account manages people and groups, and nothing else.
    const user = await json<{ id: string }>(
      await call('enableScim', 'GET', `/clients/${id}/service-account-user`),
    );
    const management = await clientUuid('enableScim', 'realm-management');
    const roles = await json<{ id: string; name: string }[]>(
      await call('enableScim', 'GET', `/clients/${management ?? ''}/roles`),
    );
    const wanted = roles.filter((r) =>
      ['manage-users', 'view-users', 'query-users', 'query-groups'].includes(r.name),
    );
    await call('enableScim', 'POST', `/users/${user.id}/role-mappings/clients/${management ?? ''}`, wanted);
    // With full scope off, only the roles in the client's scope reach its token.
    await call('enableScim', 'POST', `/clients/${id}/scope-mappings/clients/${management ?? ''}`, wanted);
    return secret;
  }

  return {
    async enable() {
      const secret = await ensureScimClient();
      await call('enableScim', 'PUT', '', { scimApiEnabled: true });
      scimToken = createAdminTokenSource({
        baseUrl: o.baseUrl,
        realm: o.realm,
        clientId: SCIM_CLIENT,
        clientSecret: secret,
        fetch: doFetch,
      });
    },

    async disable() {
      await call('disableScim', 'PUT', '', { scimApiEnabled: false });
    },

    async forward(req) {
      if (!scimToken) {
        const secret = await o.secrets.get(scimSecretKey(o.realm));
        if (!secret) throw new DirectoryError('scimForward', 0, `no stored secret for ${o.realm} SCIM`);
        scimToken = createAdminTokenSource({
          baseUrl: o.baseUrl,
          realm: o.realm,
          clientId: SCIM_CLIENT,
          clientSecret: secret,
          fetch: doFetch,
        });
      }
      const url = `${o.baseUrl}/realms/${encodeURIComponent(o.realm)}/scim/v2/${req.path}${req.query ? `?${req.query}` : ''}`;
      const res = await doFetch(url, {
        method: req.method,
        headers: {
          authorization: `Bearer ${await scimToken()}`,
          accept: 'application/scim+json, application/json',
          ...(req.body ? { 'content-type': req.contentType ?? 'application/scim+json' } : {}),
        },
        body: req.body ? new Uint8Array(req.body) : null,
      });
      const headers: Record<string, string> = {};
      for (const name of ['content-type', 'location', 'etag']) {
        const value = res.headers.get(name);
        if (value) headers[name] = value;
      }
      return { status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) };
    },

    async grantRole(kcUserId, role) {
      const api = await clientUuid('grantRole', API_CLIENT);
      const rep = await json<{ id: string; name: string }>(
        await call('grantRole', 'GET', `/clients/${api ?? ''}/roles/${role}`),
      );
      await call(
        'grantRole',
        'POST',
        `/users/${encodeURIComponent(kcUserId)}/role-mappings/clients/${api ?? ''}`,
        [rep],
      );
    },

    async isMappedGroup(groupId) {
      const res = await call(
        'isMappedGroup',
        'GET',
        `/groups/${encodeURIComponent(groupId)}`,
        undefined,
        [404],
      );
      if (res.status === 404) return false;
      const { name } = await json<{ name: string }>(res);
      return Object.keys(MAPPED_GROUPS).includes(name);
    },

    async emptyGroup(groupId) {
      const members = await json<{ id: string }[]>(
        await call('emptyGroup', 'GET', `/groups/${encodeURIComponent(groupId)}/members?first=0&max=10000`),
      );
      for (const m of members) {
        await call(
          'emptyGroup',
          'DELETE',
          `/users/${m.id}/groups/${encodeURIComponent(groupId)}`,
          undefined,
          [404],
        );
      }
    },
  };
}

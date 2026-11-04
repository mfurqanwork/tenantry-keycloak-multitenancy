import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';
import { appClientRepresentation, CUSTOMER_APP_ATTRIBUTE, type AppClientSpec } from './app-clients.js';
import { BACKEND_CLIENT } from './provisioner.js';

// The customer apps of one enterprise realm (ADR-0011), through its tenantry-backend account. Only
// clients marked as customer apps can be changed: our product clients are out of reach.
export interface RealmApps {
  create(clientId: string, spec: AppClientSpec): Promise<{ kcClientUuid: string; secret: string | null }>;
  update(kcClientUuid: string, spec: AppClientSpec): Promise<void>;
  rotateSecret(kcClientUuid: string): Promise<string>;
  // Already gone counts as done.
  remove(kcClientUuid: string): Promise<void>;
  checkClientCredentials(
    clientId: string,
    secret: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

// The client was deleted in Keycloak behind our back.
export class AppClientMissingError extends Error {
  override name = 'AppClientMissingError';
  constructor(readonly kcClientUuid: string) {
    super(`customer app client ${kcClientUuid} no longer exists`);
  }
}

export interface RealmAppsOptions {
  baseUrl: string;
  realm: string;
  // The realm's own tenantry-backend secret (ADR-0023).
  clientSecret: string;
  fetch?: typeof fetch;
}

interface KcClient {
  id: string;
  clientId: string;
  attributes?: Record<string, string>;
  [key: string]: unknown;
}

// Keycloak explains a refused client in error_description; keep that for the person, drop the JSON.
async function reason(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { error_description?: string; errorMessage?: string; error?: string };
    return body.error_description ?? body.errorMessage ?? body.error ?? text;
  } catch {
    return text;
  }
}

export function createRealmApps(o: RealmAppsOptions): RealmApps {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({
    baseUrl: o.baseUrl,
    realm: o.realm,
    clientId: BACKEND_CLIENT,
    clientSecret: o.clientSecret,
    fetch: doFetch,
  });
  const admin = `${o.baseUrl}/admin/realms/${encodeURIComponent(o.realm)}`;

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
        authorization: `Bearer ${await token()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!res.ok && !accept.includes(res.status)) {
      throw new DirectoryError(operation, res.status, await reason(res));
    }
    return res;
  }

  // The customer app behind this uuid; null when it is gone. Any other client is refused.
  async function customerApp(operation: string, kcClientUuid: string): Promise<KcClient | null> {
    const res = await call(
      operation,
      'GET',
      `/clients/${encodeURIComponent(kcClientUuid)}`,
      undefined,
      [404],
    );
    if (res.status === 404) return null;
    const client = (await res.json()) as KcClient;
    if (client.attributes?.[CUSTOMER_APP_ATTRIBUTE] !== 'true') {
      throw new DirectoryError(operation, 403, 'not a customer app');
    }
    return client;
  }

  async function secretOf(operation: string, kcClientUuid: string, method: 'GET' | 'POST'): Promise<string> {
    const res = await call(operation, method, `/clients/${encodeURIComponent(kcClientUuid)}/client-secret`);
    return ((await res.json()) as { value: string }).value;
  }

  return {
    async create(clientId, spec) {
      const res = await call('createApp', 'POST', '/clients', appClientRepresentation(clientId, spec));
      const kcClientUuid = res.headers.get('location')?.split('/').pop();
      if (!kcClientUuid) throw new DirectoryError('createApp', res.status, 'no Location header');
      const secret =
        spec.type === 'web' || spec.type === 'm2m' ? await secretOf('createApp', kcClientUuid, 'GET') : null;
      return { kcClientUuid, secret };
    },

    async update(kcClientUuid, spec) {
      const existing = await customerApp('updateApp', kcClientUuid);
      if (!existing) throw new AppClientMissingError(kcClientUuid);
      const next = appClientRepresentation(existing.clientId, spec);
      await call('updateApp', 'PUT', `/clients/${encodeURIComponent(kcClientUuid)}`, {
        ...existing,
        ...next,
        attributes: { ...existing.attributes, ...(next['attributes'] as Record<string, string>) },
      });
    },

    async rotateSecret(kcClientUuid) {
      if (!(await customerApp('rotateSecret', kcClientUuid))) throw new AppClientMissingError(kcClientUuid);
      return secretOf('rotateSecret', kcClientUuid, 'POST');
    },

    async remove(kcClientUuid) {
      if (!(await customerApp('removeApp', kcClientUuid))) return;
      await call('removeApp', 'DELETE', `/clients/${encodeURIComponent(kcClientUuid)}`, undefined, [404]);
    },

    async checkClientCredentials(clientId, secret) {
      const res = await doFetch(
        `${o.baseUrl}/realms/${encodeURIComponent(o.realm)}/protocol/openid-connect/token`,
        {
          method: 'POST',
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: secret,
          }),
        },
      );
      if (res.ok) return { ok: true };
      if (res.status >= 500) throw new DirectoryError('checkClientCredentials', res.status);
      return { ok: false, error: await reason(res) };
    },
  };
}

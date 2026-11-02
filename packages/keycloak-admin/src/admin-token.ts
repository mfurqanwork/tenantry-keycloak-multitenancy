import { DirectoryError } from './errors.js';

export interface AdminTokenOptions {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  fetch: typeof fetch;
}

// Client-credentials token for the tenantry-backend service account, reused until 30 s before expiry.
export function createAdminTokenSource(o: AdminTokenOptions): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  const fetchToken = async (): Promise<string> => {
    const res = await o.fetch(`${o.baseUrl}/realms/${o.realm}/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: o.clientId,
        client_secret: o.clientSecret,
      }),
    });
    if (!res.ok) throw new DirectoryError('token', res.status);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 30) * 1000 };
    return body.access_token;
  };

  return () => {
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.token);
    pending ??= fetchToken().finally(() => {
      pending = null;
    });
    return pending;
  };
}

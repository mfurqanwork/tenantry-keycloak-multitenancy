export interface Config {
  issuer: string;
  clientId: string;
  clientSecret: string;
  // Where this process reaches Keycloak, when the issuer's own address does not resolve here.
  authInternalUrl: string | null;
  port: 4000;
  // 127.0.0.1, not localhost: the realm accepts loopback redirects by address only (ADR-0011).
  baseUrl: 'http://127.0.0.1:4000';
}

function need(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Set ${key} (pnpm seed writes examples/customer-app/.env).`);
  return value;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  return {
    issuer: need(env, 'ISSUER'),
    clientId: need(env, 'CLIENT_ID'),
    clientSecret: need(env, 'CLIENT_SECRET'),
    authInternalUrl: env['AUTH_INTERNAL_URL'] || null,
    port: 4000,
    baseUrl: 'http://127.0.0.1:4000',
  };
}

// A URL on the issuer's host, sent to the internal address instead; anything else is left alone.
export function internalUrl(url: string, issuer: string, authInternalUrl: string | null): string {
  if (!authInternalUrl) return url;
  const from = new URL(issuer).origin;
  return url.startsWith(from) ? authInternalUrl.replace(/\/$/, '') + url.slice(from.length) : url;
}

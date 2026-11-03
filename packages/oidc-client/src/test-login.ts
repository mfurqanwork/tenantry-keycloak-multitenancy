// The portal's "Test sign-in" for a customer app (ADR-0011): a real authorization-code sign-in with
// PKCE against the app's own client, ending on the portal's test callback. The endpoints come from the
// app's connection details, so no discovery request is needed.
export interface TestLoginStart {
  appId: string;
  clientId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  // Public clients trade the code for tokens; a client with a secret stops at the code (we never hold it).
  exchange: boolean;
}

export type TestLoginResult =
  | {
      kind: 'claims';
      appId: string;
      claims: { iss: string; sub: string; aud: string | string[]; exp: number };
    }
  | { kind: 'signed-in'; appId: string }
  | { kind: 'error'; appId: string | null; error: string; description: string | null }
  | { kind: 'expired' };

interface Pending {
  appId: string;
  clientId: string;
  tokenEndpoint: string;
  redirectUri: string;
  verifier: string;
  exchange: boolean;
}

const KEY = 'tenantry.test-login.';

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const random = (size: number) => base64url(crypto.getRandomValues(new Uint8Array(size)));

async function challengeOf(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

export async function startTestLogin(
  o: TestLoginStart,
  go: (url: string) => void = (url) => {
    window.location.assign(url);
  },
): Promise<void> {
  const state = random(24);
  const verifier = random(32);
  const pending: Pending = {
    appId: o.appId,
    clientId: o.clientId,
    tokenEndpoint: o.tokenEndpoint,
    redirectUri: o.redirectUri,
    verifier,
    exchange: o.exchange,
  };
  sessionStorage.setItem(KEY + state, JSON.stringify(pending));
  const url = new URL(o.authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: await challengeOf(verifier),
    code_challenge_method: 'S256',
  }).toString();
  go(url.toString());
}

// The ID token's claims, for display only: its signature is not checked, and nothing trusts it.
function claimsOf(idToken: string): { iss: string; sub: string; aud: string | string[]; exp: number } {
  const payload = idToken.split('.')[1] ?? '';
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  const { iss, sub, aud, exp } = JSON.parse(json) as {
    iss: string;
    sub: string;
    aud: string | string[];
    exp: number;
  };
  return { iss, sub, aud, exp };
}

// Reads the callback URL once: a state is used at most one time.
export async function finishTestLogin(url: string, fetchFn: typeof fetch = fetch): Promise<TestLoginResult> {
  const params = new URL(url).searchParams;
  const state = params.get('state') ?? '';
  const stored = sessionStorage.getItem(KEY + state);
  sessionStorage.removeItem(KEY + state);
  if (!stored) return { kind: 'expired' };
  const pending = JSON.parse(stored) as Pending;
  const error = params.get('error');
  if (error) {
    return { kind: 'error', appId: pending.appId, error, description: params.get('error_description') };
  }
  const code = params.get('code');
  if (!code) return { kind: 'error', appId: pending.appId, error: 'no_code', description: null };
  if (!pending.exchange) return { kind: 'signed-in', appId: pending.appId };
  const res = await fetchFn(pending.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    }).toString(),
  });
  const body = (await res.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.id_token) {
    return {
      kind: 'error',
      appId: pending.appId,
      error: body.error ?? `token_${String(res.status)}`,
      description: body.error_description ?? null,
    };
  }
  return { kind: 'claims', appId: pending.appId, claims: claimsOf(body.id_token) };
}

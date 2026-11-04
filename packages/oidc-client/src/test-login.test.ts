import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finishTestLogin, startTestLogin, type TestLoginStart } from './test-login.js';

const start: TestLoginStart = {
  appId: 'a1',
  clientId: 'app-0a1b2c3d',
  authorizationEndpoint: 'https://auth.test/realms/ent-x/protocol/openid-connect/auth',
  tokenEndpoint: 'https://auth.test/realms/ent-x/protocol/openid-connect/token',
  redirectUri: 'https://x.portal.test/applications/test-callback',
  exchange: true,
};

const b64 = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const idToken = `${b64({ alg: 'RS256' })}.${b64({
  iss: 'https://auth.test/realms/ent-x',
  sub: 'u-1',
  aud: 'app-0a1b2c3d',
  exp: 1893456000,
})}.sig`;

// Runs startTestLogin and returns the URL it would send the browser to.
async function begin(o: TestLoginStart = start): Promise<URL> {
  let target = '';
  await startTestLogin(o, (url) => {
    target = url;
  });
  return new URL(target);
}
const back = (params: Record<string, string>) =>
  `${start.redirectUri}?${new URLSearchParams(params).toString()}`;

beforeEach(() => {
  sessionStorage.clear();
});

describe('test sign-in', () => {
  it('sends the browser to Keycloak with PKCE for this client', async () => {
    const url = await begin();
    expect(`${url.origin}${url.pathname}`).toBe(start.authorizationEndpoint);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'app-0a1b2c3d',
      redirect_uri: start.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge_method: 'S256',
    });
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it('trades the code for tokens and shows who signed in (public clients)', async () => {
    const url = await begin();
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id_token: idToken }), { status: 200 }));
    const result = await finishTestLogin(
      back({ code: 'c1', state: url.searchParams.get('state') ?? '' }),
      fetchFn,
    );
    expect(result).toEqual({
      kind: 'claims',
      appId: 'a1',
      claims: { iss: 'https://auth.test/realms/ent-x', sub: 'u-1', aud: 'app-0a1b2c3d', exp: 1893456000 },
    });
    const [endpoint, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe(start.tokenEndpoint);
    const body = new URLSearchParams(init.body as string);
    expect(Object.fromEntries(body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'c1',
      client_id: 'app-0a1b2c3d',
      redirect_uri: start.redirectUri,
    });
    expect(body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('stops at the code for a client with a secret', async () => {
    const url = await begin({ ...start, exchange: false });
    const fetchFn = vi.fn();
    expect(
      await finishTestLogin(back({ code: 'c1', state: url.searchParams.get('state') ?? '' }), fetchFn),
    ).toEqual({
      kind: 'signed-in',
      appId: 'a1',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows Keycloak's error", async () => {
    const url = await begin();
    const result = await finishTestLogin(
      back({
        error: 'access_denied',
        error_description: 'Not allowed',
        state: url.searchParams.get('state') ?? '',
      }),
      vi.fn(),
    );
    expect(result).toEqual({
      kind: 'error',
      appId: 'a1',
      error: 'access_denied',
      description: 'Not allowed',
    });
  });

  it('treats an unknown or used state as expired', async () => {
    expect(await finishTestLogin(back({ code: 'c1', state: 'nope' }), vi.fn())).toEqual({ kind: 'expired' });
    const url = await begin({ ...start, exchange: false });
    const again = back({ code: 'c1', state: url.searchParams.get('state') ?? '' });
    expect((await finishTestLogin(again, vi.fn())).kind).toBe('signed-in');
    expect(await finishTestLogin(again, vi.fn())).toEqual({ kind: 'expired' });
  });
});

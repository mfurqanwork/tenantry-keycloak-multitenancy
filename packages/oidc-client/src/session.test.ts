import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for oidc-client-ts's UserManager: each test decides what the stored user is and
// whether trading the refresh token works.
const manager = {
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  signoutRedirect: vi.fn(),
  signinRedirect: vi.fn(),
};
vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn(function UserManager() {
    return manager;
  }),
  WebStorageStateStore: vi.fn(),
}));

const { createAuthClient } = await import('./auth-client.js');

const client = () =>
  createAuthClient({
    issuer: 'http://auth.tenantry.localhost/realms/platform',
    clientId: 'tenantry-web',
    organization: 'acme',
    redirectUri: 'http://acme.tenantry.localhost/auth/callback',
  });
const stored = { expired: false, refresh_token: 'r', id_token: 'id-token', profile: {} };

beforeEach(() => {
  vi.clearAllMocks();
  manager.getUser.mockResolvedValue(stored);
  manager.removeUser.mockResolvedValue(undefined);
});

describe('checkSession', () => {
  it('keeps the session when the refresh token still works', async () => {
    manager.signinSilent.mockResolvedValue(stored);
    await expect(client().checkSession()).resolves.toBe(true);
    expect(manager.removeUser).not.toHaveBeenCalled();
  });

  it('forgets the user when Keycloak has ended the session', async () => {
    manager.signinSilent.mockRejectedValue(new Error('invalid_grant: Session not active'));
    await expect(client().checkSession()).resolves.toBe(false);
    expect(manager.removeUser).toHaveBeenCalledTimes(1);
  });

  it('is false with nobody signed in', async () => {
    manager.getUser.mockResolvedValue(null);
    await expect(client().checkSession()).resolves.toBe(false);
    expect(manager.signinSilent).not.toHaveBeenCalled();
  });

  it('trades the refresh token once for calls at the same time', async () => {
    let finish: (u: unknown) => void = () => undefined;
    manager.signinSilent.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const c = client();
    const both = Promise.all([c.checkSession(), c.checkSession()]);
    await vi.waitFor(() => {
      expect(manager.signinSilent).toHaveBeenCalled();
    });
    finish(stored);
    await expect(both).resolves.toEqual([true, true]);
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });
});

describe('signOut', () => {
  it('ends the Keycloak session with the id token as a hint', async () => {
    manager.signoutRedirect.mockResolvedValue(undefined);
    await client().signOut();
    expect(manager.signoutRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ id_token_hint: 'id-token' }),
    );
  });
});

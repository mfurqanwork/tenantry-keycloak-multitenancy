import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, makeMe, renderPortal } from '../../test-utils.js';
import { TestCallbackRoute } from './TestCallbackRoute.js';

const finishTestLogin = vi.fn();
vi.mock('@tenantry/oidc-client', () => ({
  finishTestLogin: (...args: unknown[]): unknown => finishTestLogin(...args),
}));

const me = makeMe('admin', ['apps:read', 'apps:register']);
const show = () => {
  renderPortal(<TestCallbackRoute />, {
    api: fakeApi(),
    me,
    path: '/applications/test-callback?code=c&state=s',
  });
};

beforeEach(() => {
  finishTestLogin.mockReset();
});

describe('TestCallbackRoute', () => {
  it("shows the token's claims for a public client", async () => {
    finishTestLogin.mockResolvedValue({
      kind: 'claims',
      appId: 'a1',
      claims: { iss: 'http://auth.test/realms/ent-acme', sub: 'u-1', aud: 'app-0a1b2c3d', exp: 1893456000 },
    });
    show();
    expect(await screen.findByText('Sign-in works')).toBeInTheDocument();
    expect(screen.getByText('http://auth.test/realms/ent-acme')).toBeInTheDocument();
    expect(screen.getByText('u-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the app' })).toHaveAttribute(
      'href',
      '/advanced/apps/a1',
    );
  });

  it('says Keycloak signed the person in, for a client with a secret', async () => {
    finishTestLogin.mockResolvedValue({ kind: 'signed-in', appId: 'a1' });
    show();
    expect(
      await screen.findByText('Keycloak signed you in (me@example.com) for this app.'),
    ).toBeInTheDocument();
  });

  it("shows Keycloak's error", async () => {
    finishTestLogin.mockResolvedValue({
      kind: 'error',
      appId: 'a1',
      error: 'access_denied',
      description: 'Not allowed',
    });
    show();
    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument();
    expect(screen.getByText('access_denied: Not allowed')).toBeInTheDocument();
  });

  it('stale state', async () => {
    finishTestLogin.mockResolvedValue({ kind: 'expired' });
    show();
    expect(await screen.findByText('This test sign-in has expired. Start it again.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to applications' })).toHaveAttribute(
      'href',
      '/advanced/apps',
    );
  });
});

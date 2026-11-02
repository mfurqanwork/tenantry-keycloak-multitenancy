import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthClient, AuthUser } from './auth-client.js';
import { AuthProvider, useAuth } from './AuthProvider.js';

function fakeClient(user: AuthUser | null): AuthClient & { signIn: ReturnType<typeof vi.fn> } {
  return {
    settings: { authority: 'x', client_id: 'y', redirect_uri: 'z', response_type: 'code', scope: 'openid' },
    signIn: vi.fn().mockResolvedValue(undefined),
    handleCallback: vi.fn().mockResolvedValue('/'),
    getAccessToken: vi.fn().mockResolvedValue(user ? 'token' : null),
    signOut: vi.fn().mockResolvedValue(undefined),
    user: vi.fn().mockResolvedValue(user),
  };
}

function Who() {
  const { user } = useAuth();
  return <p>Signed in as {user.email}</p>;
}

describe('AuthProvider', () => {
  it('shows the fallback, then the app once signed in', async () => {
    render(
      <AuthProvider
        client={fakeClient({ email: 'ada@example.com', name: 'Ada' })}
        fallback={<p>Signing in</p>}
      >
        <Who />
      </AuthProvider>,
    );
    expect(screen.getByText('Signing in')).toBeInTheDocument();
    expect(await screen.findByText('Signed in as ada@example.com')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in', async () => {
    const client = fakeClient(null);
    render(
      <AuthProvider client={client} fallback={<p>Signing in</p>}>
        <Who />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(client.signIn).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it('finishes a sign-in on the callback path and returns to where the visitor was', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=abc&state=xyz');
    const client = fakeClient({ email: 'ada@example.com', name: null });
    vi.mocked(client.handleCallback).mockResolvedValue('/members');
    render(
      <AuthProvider client={client} fallback={<p>Signing in</p>}>
        <Who />
      </AuthProvider>,
    );
    expect(await screen.findByText('Signed in as ada@example.com')).toBeInTheDocument();
    expect(client.handleCallback).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/members');
  });
});

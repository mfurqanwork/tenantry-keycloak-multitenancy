import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthClient, AuthUser } from './auth-client.js';
import { AuthProvider, useAuth } from './AuthProvider.js';

function fakeClient(
  user: AuthUser | null,
): AuthClient & { signIn: ReturnType<typeof vi.fn>; checkSession: ReturnType<typeof vi.fn> } {
  return {
    settings: { authority: 'x', client_id: 'y', redirect_uri: 'z', response_type: 'code', scope: 'openid' },
    signIn: vi.fn().mockResolvedValue(undefined),
    handleCallback: vi.fn().mockResolvedValue('/'),
    getAccessToken: vi.fn().mockResolvedValue(user ? 'token' : null),
    signOut: vi.fn().mockResolvedValue(undefined),
    user: vi.fn().mockResolvedValue(user),
    checkSession: vi.fn().mockResolvedValue(true),
  };
}

function showTab() {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
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

  it('tells the router the address changed after the callback', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=abc&state=xyz');
    const client = fakeClient({ email: 'ada@example.com', name: null });
    vi.mocked(client.handleCallback).mockResolvedValue('/members');
    const seen: string[] = [];
    const listener = () => {
      seen.push(window.location.pathname);
    };
    window.addEventListener('popstate', listener);
    render(
      <AuthProvider client={client} fallback={<p>Signing in</p>}>
        <Who />
      </AuthProvider>,
    );
    await screen.findByText('Signed in as ada@example.com');
    window.removeEventListener('popstate', listener);
    expect(seen).toEqual(['/members']);
  });

  it('checks the session when the tab comes back, and signs in again once if it has ended', async () => {
    window.history.replaceState(null, '', '/');
    const client = fakeClient({ email: 'ada@example.com', name: null });
    render(
      <AuthProvider client={client} fallback={<p>Signing in</p>}>
        <Who />
      </AuthProvider>,
    );
    await screen.findByText('Signed in as ada@example.com');
    client.checkSession.mockResolvedValue(false);
    act(() => {
      showTab();
      showTab();
    });
    await waitFor(() => {
      expect(client.signIn).toHaveBeenCalledTimes(1);
    });
    expect(client.checkSession).toHaveBeenCalled();
  });

  it('does nothing while the session is alive', async () => {
    window.history.replaceState(null, '', '/');
    const client = fakeClient({ email: 'ada@example.com', name: null });
    render(
      <AuthProvider client={client} fallback={<p>Signing in</p>}>
        <Who />
      </AuthProvider>,
    );
    await screen.findByText('Signed in as ada@example.com');
    act(() => {
      showTab();
    });
    await waitFor(() => {
      expect(client.checkSession).toHaveBeenCalled();
    });
    expect(client.signIn).not.toHaveBeenCalled();
  });
});

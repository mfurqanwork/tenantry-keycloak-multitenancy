import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import type { AuthConfig } from './auth-config.js';

export interface AuthUser {
  email: string | null;
  name: string | null;
}

export interface AuthSettings {
  authority: string;
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
}

export interface AuthClient {
  readonly settings: AuthSettings;
  // Redirects to Keycloak; remembers the current path to come back to.
  signIn: () => Promise<void>;
  // Finishes the redirect on /auth/callback and returns the path to go back to.
  handleCallback: () => Promise<string>;
  // A current access token, renewed with the refresh token when it has expired; null when signed out.
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  user: () => Promise<AuthUser | null>;
}

// Authorization code with PKCE (S256, the oidc-client-ts default). Tokens live in sessionStorage,
// one tab's session at a time. ADR-0009.
export function createAuthClient(config: AuthConfig & { redirectUri: string }): AuthClient {
  const settings: AuthSettings = {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.organization ? `openid organization:${config.organization}` : 'openid',
  };
  const manager = new UserManager({
    ...settings,
    post_logout_redirect_uri: new URL('/', config.redirectUri).toString(),
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false,
  });

  const current = async () => {
    const user = await manager.getUser();
    if (!user) return null;
    if (!user.expired) return user;
    // Access tokens live five minutes; trade the refresh token rather than redirecting.
    try {
      return user.refresh_token ? await manager.signinSilent() : null;
    } catch {
      await manager.removeUser();
      return null;
    }
  };

  return {
    settings,
    signIn: () =>
      manager.signinRedirect({ state: { returnTo: `${window.location.pathname}${window.location.search}` } }),
    async handleCallback() {
      const user = await manager.signinRedirectCallback();
      const state = user.state as { returnTo?: unknown } | undefined;
      const returnTo =
        typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') ? state.returnTo : '/';
      return returnTo.startsWith('//') ? '/' : returnTo;
    },
    async getAccessToken() {
      return (await current())?.access_token ?? null;
    },
    signOut: () => manager.signoutRedirect(),
    async user() {
      const user = await current();
      if (!user) return null;
      const profile = user.profile;
      return { email: profile.email ?? null, name: profile.name ?? null };
    },
  };
}

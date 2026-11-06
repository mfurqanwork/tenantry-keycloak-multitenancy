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
  // 'create' opens Keycloak's registration page first (Keycloak 26), with a link to sign in instead.
  prompt?: 'create';
}

export interface AuthClient {
  readonly settings: AuthSettings;
  // Redirects to Keycloak; remembers the current path to come back to.
  signIn: () => Promise<void>;
  // Finishes the redirect on /auth/callback and returns the path to go back to.
  handleCallback: () => Promise<string>;
  // A current access token, renewed with the refresh token when it has expired; null when signed out.
  getAccessToken: () => Promise<string | null>;
  // Ends the Keycloak session, which signs this person out of every app (ADR-0020).
  signOut: () => Promise<void>;
  user: () => Promise<AuthUser | null>;
  // Asks Keycloak whether the session still exists by trading the refresh token. False, and the user
  // forgotten, when it has ended (signed out in another app, or expired).
  checkSession: () => Promise<boolean>;
}

// Authorization code with PKCE (S256, the oidc-client-ts default). Tokens live in sessionStorage,
// one tab's session at a time. ADR-0009.
export function createAuthClient(
  config: AuthConfig & { redirectUri: string; prompt?: 'create' },
): AuthClient {
  const settings: AuthSettings = {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.organization ? `openid organization:${config.organization}` : 'openid',
    ...(config.prompt ? { prompt: config.prompt } : {}),
  };
  const manager = new UserManager({
    ...settings,
    post_logout_redirect_uri: new URL('/', config.redirectUri).toString(),
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false,
  });

  // One refresh at a time: two requests (or a request and a focus check) share it. Only Keycloak's
  // invalid_grant means the session is over; a network failure or a Keycloak error leaves it unknown,
  // and the person stays signed in (ADR-0020).
  type Refreshed = { user: Awaited<ReturnType<UserManager['signinSilent']>>; ended: false } | { ended: true };
  let refreshing: Promise<Refreshed | null> | null = null;
  const refresh = async (): Promise<Refreshed | null> => {
    refreshing ??= (async () => {
      try {
        return { user: await manager.signinSilent(), ended: false as const };
      } catch (err) {
        if ((err as { error?: unknown }).error !== 'invalid_grant') return null;
        await manager.removeUser();
        return { ended: true as const };
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };

  const current = async () => {
    const user = await manager.getUser();
    if (!user) return null;
    if (!user.expired) return user;
    // Access tokens live five minutes; trade the refresh token rather than redirecting.
    if (!user.refresh_token) return null;
    const refreshed = await refresh();
    return refreshed && !refreshed.ended ? refreshed.user : null;
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
    async signOut() {
      const user = await manager.getUser();
      await manager.signoutRedirect(user?.id_token ? { id_token_hint: user.id_token } : {});
    },
    async checkSession() {
      const user = await manager.getUser();
      if (!user?.refresh_token) return false;
      // Unknown (Keycloak unreachable) counts as alive; only an ended session signs the app out.
      return (await refresh())?.ended !== true;
    },
    async user() {
      const user = await current();
      if (!user) return null;
      const profile = user.profile;
      return { email: profile.email ?? null, name: profile.name ?? null };
    },
  };
}

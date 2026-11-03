import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AuthClient, AuthUser } from './auth-client.js';

export const CALLBACK_PATH = '/auth/callback';

interface AuthContextValue {
  user: AuthUser;
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);


// Renders children only for a signed-in user: finishes a callback, or sends the visitor to sign in.
export function AuthProvider({
  client,
  fallback = null,
  children,
}: {
  client: AuthClient;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // One redirect: a second check while the first redirect is leaving the page would start another.
  const redirecting = useRef(false);

  useEffect(() => {
    // An object, so the flag read after an await is not narrowed to its initial value.
    const run = { cancelled: false };
    void (async () => {
      if (window.location.pathname === CALLBACK_PATH) {
        const returnTo = await client.handleCallback();
        window.history.replaceState(null, '', returnTo);
        // replaceState is silent; routers (React Router included) re-read the address on popstate.
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      const current = await client.user();
      if (run.cancelled) return;
      if (current) setUser(current);
      else await client.signIn();
    })();
    return () => {
      run.cancelled = true;
    };
  }, [client]);

  // Single logout: when the tab comes back, ask Keycloak whether the session still exists. Signing
  // out in the other app ended it, so this app goes to the login page too (ADR-0020).
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || redirecting.current) return;
      void client.checkSession().then((alive) => {
        if (alive || redirecting.current) return;
        redirecting.current = true;
        setUser(null);
        void client.signIn();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client, user]);

  if (!user) return <>{fallback}</>;
  return (
    <AuthContext.Provider value={{ user, getAccessToken: client.getAccessToken, signOut: client.signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

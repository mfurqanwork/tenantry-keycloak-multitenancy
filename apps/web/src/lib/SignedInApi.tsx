import { useAuth } from '@tenantry/oidc-client';
import { useMemo, type ReactNode } from 'react';
import { ApiProvider, createApi } from './api.js';

// Inside <AuthProvider>: every API call carries the signed-in user's access token.
export function SignedInApi({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

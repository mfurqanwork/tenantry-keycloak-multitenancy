import { InlineLoading } from '@carbon/react';
import {
  AuthProvider,
  CALLBACK_PATH,
  createAuthClient,
  fetchAuthConfig,
  type AuthConfig,
} from '@tenantry/oidc-client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LoadMe } from './me.js';
import { SignedInApi } from './SignedInApi.js';

export interface TenantSession {
  signOut: () => void;
}

// A tenant host in either app: ask the API which realm, client and organization this host signs in
// to, sign in, then load who the person is here. `notFound` shows for a workspace that does not exist.
export function TenantAuth({
  slug,
  notFound,
  children,
}: {
  slug: string;
  notFound: ReactNode;
  children: (session: TenantSession) => ReactNode;
}) {
  const [config, setConfig] = useState<AuthConfig | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    fetchAuthConfig(slug).then(
      (found) => {
        if (current) setConfig(found);
      },
      () => {
        if (current) setConfig(null);
      },
    );
    return () => {
      current = false;
    };
  }, [slug]);

  const client = useMemo(
    () => config && createAuthClient({ ...config, redirectUri: `${window.location.origin}${CALLBACK_PATH}` }),
    [config],
  );

  if (config === null) return notFound;
  if (!client) return <InlineLoading description="Loading" />;
  return (
    <AuthProvider client={client} fallback={<InlineLoading description="Signing in" />}>
      <SignedInApi>
        <LoadMe>
          {children({
            signOut: () => {
              void client.signOut();
            },
          })}
        </LoadMe>
      </SignedInApi>
    </AuthProvider>
  );
}

import { InlineLoading } from '@carbon/react';
import { AuthProvider, CALLBACK_PATH, createAuthClient } from '@tenantry/oidc-client';
import { AppShell } from '@tenantry/ui';
import { useMemo } from 'react';
import { apexAuthConfig } from '../../lib/host.js';
import { RouterLink } from '../../lib/RouterLink.js';
import { SignedInApi } from '../../lib/SignedInApi.js';
import { SignupRoute } from './SignupRoute.js';

// The apex host: sign in (or register) in Keycloak, then create a workspace (ADR-0018).
export function SignupApp({ baseDomain }: { baseDomain: string }) {
  const client = useMemo(
    () =>
      createAuthClient({
        ...apexAuthConfig(new URL(window.location.href), baseDomain),
        redirectUri: `${window.location.origin}${CALLBACK_PATH}`,
      }),
    [baseDomain],
  );
  return (
    <AppShell productName="Tenantry" navItems={[]} currentPath="/" linkAs={RouterLink}>
      <AuthProvider client={client} fallback={<InlineLoading description="Signing in" />}>
        <SignedInApi>
          <SignupRoute
            baseDomain={baseDomain}
            onCreated={(url) => {
              window.location.assign(url);
            }}
          />
        </SignedInApi>
      </AuthProvider>
    </AppShell>
  );
}

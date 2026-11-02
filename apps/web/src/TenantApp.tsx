import { InlineLoading } from '@carbon/react';
import {
  AuthProvider,
  CALLBACK_PATH,
  createAuthClient,
  fetchAuthConfig,
  type AuthConfig,
} from '@tenantry/oidc-client';
import { AppShell } from '@tenantry/ui';
import { useEffect, useMemo, useState } from 'react';
import { App } from './App.js';
import { NotFoundPage } from './features/not-found/NotFoundPage.js';
import { SignedInApi } from './lib/SignedInApi.js';

// A tenant host: ask the API which realm and organization this slug signs in to, then sign in.
export function TenantApp({ slug, signupUrl }: { slug: string; signupUrl: string }) {
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

  if (config === null) {
    return (
      <AppShell productName="Tenantry" navItems={[]} currentPath="/">
        <NotFoundPage signupUrl={signupUrl} />
      </AppShell>
    );
  }
  if (!client) return <InlineLoading description="Loading" />;
  return (
    <AuthProvider client={client} fallback={<InlineLoading description="Signing in" />}>
      <SignedInApi>
        <App hostname={window.location.hostname} />
      </SignedInApi>
    </AuthProvider>
  );
}

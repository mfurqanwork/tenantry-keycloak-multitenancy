import { TenantAuth } from '@tenantry/app-kit';
import { AppShell, EmptyState, Page, TenantryThemeProvider } from '@tenantry/ui';
import { SearchX } from 'lucide-react';
import { App } from './App.js';
import { BASE_DOMAIN, portalSlugFromHost } from './lib/host.js';

function NoWorkspace() {
  return (
    <AppShell productName="Tenantry Portal" navItems={[]} currentPath="/">
      <Page>
        <EmptyState
          icon={SearchX}
          title="No workspace here"
          body="There is no workspace at this address."
        />
      </Page>
    </AppShell>
  );
}

// The portal of one workspace: <slug>.portal.<base domain>. SSO signs the person in from the web app.
export function Root() {
  const slug = portalSlugFromHost(window.location.hostname, BASE_DOMAIN);
  return (
    <TenantryThemeProvider>
      {slug ? (
        <TenantAuth slug={slug} notFound={<NoWorkspace />}>
          {(session) => <App onSignOut={session.signOut} />}
        </TenantAuth>
      ) : (
        <NoWorkspace />
      )}
    </TenantryThemeProvider>
  );
}

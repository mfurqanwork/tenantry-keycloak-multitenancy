import { Tile } from '@carbon/react';
import { TenantAuth } from '@tenantry/app-kit';
import { AppShell, TenantryThemeProvider } from '@tenantry/ui';
import { App } from './App.js';
import { BASE_DOMAIN, portalSlugFromHost } from './lib/host.js';

function NoWorkspace() {
  return (
    <AppShell productName="Tenantry Portal" navItems={[]} currentPath="/">
      <Tile>There is no workspace at this address.</Tile>
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

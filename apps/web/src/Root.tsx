import { AppShell, TenantryThemeProvider } from '@tenantry/ui';
import { SignupApp } from './features/signup/SignupApp.js';
import { NotFoundPage } from './features/not-found/NotFoundPage.js';
import { BASE_DOMAIN, DEMO_WORKSPACES, apexPage, hostKind } from './lib/host.js';
import { WelcomeRoute } from './features/welcome/WelcomeRoute.js';
import { TenantApp } from './TenantApp.js';

// The hostname decides which app this is: the welcome page and signup on the base domain, a tenant on
// <slug>.<base domain>.
export function Root() {
  const host = hostKind(window.location.hostname, BASE_DOMAIN);
  const port = window.location.port ? `:${window.location.port}` : '';
  const signupUrl = `${window.location.protocol}//${BASE_DOMAIN}${port}/`;
  return (
    <TenantryThemeProvider>
      {host.kind === 'apex' &&
        (apexPage(window.location.pathname) === 'signup' ? (
          <SignupApp baseDomain={BASE_DOMAIN} />
        ) : (
          <AppShell productName="Tenantry" navItems={[]} currentPath="/">
            <WelcomeRoute baseDomain={BASE_DOMAIN} demoWorkspaces={DEMO_WORKSPACES} />
          </AppShell>
        ))}
      {host.kind === 'tenant' && <TenantApp slug={host.slug} signupUrl={signupUrl} />}
      {host.kind === 'unknown' && (
        <AppShell productName="Tenantry" navItems={[]} currentPath="/">
          <NotFoundPage signupUrl={signupUrl} baseDomain={BASE_DOMAIN} />
        </AppShell>
      )}
    </TenantryThemeProvider>
  );
}

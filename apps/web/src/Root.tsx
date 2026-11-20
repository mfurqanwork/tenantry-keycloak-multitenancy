import { AppShell, TenantryThemeProvider } from '@tenantry/ui';
import { SignupApp } from './features/signup/SignupApp.js';
import { NotFoundPage } from './features/not-found/NotFoundPage.js';
import { PageNotFound } from './features/not-found/PageNotFound.js';
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
    // The welcome page and signup start light; workspaces follow the system until the person picks.
    <TenantryThemeProvider fallback={host.kind === 'apex' ? 'light' : 'system'}>
      {host.kind === 'apex' && apexPage(window.location.pathname) === 'not-found' && (
        <AppShell productName="Tenantry" navItems={[]} currentPath={window.location.pathname}>
          <PageNotFound homeHref="/" homeLabel="Go to the welcome page" />
        </AppShell>
      )}
      {host.kind === 'apex' &&
        apexPage(window.location.pathname) !== 'not-found' &&
        (apexPage(window.location.pathname) === 'signup' ? (
          <SignupApp baseDomain={BASE_DOMAIN} />
        ) : (
          // The welcome page brings its own top bar and footer.
          <WelcomeRoute
            baseDomain={BASE_DOMAIN}
            demoWorkspaces={DEMO_WORKSPACES}
            demoPassword={import.meta.env['VITE_DEMO_PASSWORD'] as string | undefined}
          />
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

import { TenantAuth } from '@tenantry/app-kit';
import { AppShell } from '@tenantry/ui';
import { App } from './App.js';
import { NotFoundPage } from './features/not-found/NotFoundPage.js';

// A tenant host: sign in to this workspace, then show the app.
export function TenantApp({ slug, signupUrl }: { slug: string; signupUrl: string }) {
  return (
    <TenantAuth
      slug={slug}
      notFound={
        <AppShell productName="Tenantry" navItems={[]} currentPath="/">
          <NotFoundPage signupUrl={signupUrl} />
        </AppShell>
      }
    >
      {(session) => <App onSignOut={session.signOut} />}
    </TenantAuth>
  );
}

import {
  appLinks,
  canSeeAdmin,
  NotificationsBell,
  RouterLink,
  useBranding,
  useMe,
  useWorkspaces,
  workspaceMenu,
  WorkspaceSearch,
} from '@tenantry/app-kit';
import { AppShell, type NavItem } from '@tenantry/ui';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { ApplicationsRoute } from './features/applications/ApplicationsRoute.js';
import { AppDetailRoute } from './features/applications/AppDetailRoute.js';
import { RegisterAppRoute } from './features/applications/RegisterAppRoute.js';
import { TestCallbackRoute } from './features/applications/TestCallbackRoute.js';
import { AuditRoute } from './features/audit/AuditRoute.js';
import { BrandingRoute } from './features/branding/BrandingRoute.js';
import { NotAllowedPage } from './features/not-allowed/NotAllowedPage.js';
import { PeopleRoute } from './features/people/PeopleRoute.js';
import { ScimRoute } from './features/scim/ScimRoute.js';
import { SecurityRoute } from './features/security/SecurityRoute.js';

type Person = ReturnType<typeof useMe>;
const enterpriseApps = (me: Person) => me.tenant.tier === 'enterprise' && me.can('apps:register');

// The first of Admin's own pages in the menu: where Admin opens.
function firstHere(items: NavItem[]): string | undefined {
  for (const item of items) {
    const found = item.children
      ? firstHere(item.children)
      : !item.crossApp && !item.external
        ? item.href
        : undefined;
    if (found) return found;
  }
  return undefined;
}

// An app address from before Phase 6a: /applications/<id> lives at /advanced/apps/<id> now.
function OldAppAddress() {
  const { id } = useParams();
  return <Navigate replace to={`/advanced/apps/${id ?? ''}`} />;
}

// The workspace's Admin, once signed in: people, settings and the advanced tools. Root supplies the theme.
export function App({ onSignOut }: { onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const workspaces = useWorkspaces();
  const { branding, reload } = useBranding(me.tenant.slug);
  const admin = canSeeAdmin(me.can);
  // The same menu as Tenantry's (spec 8.1); a member, who has no Admin pages, gets none here.
  const nav = admin ? workspaceMenu(me, workspaces, 'portal') : [];
  const first = firstHere(nav);
  const settings = me.can('tenant:settings');
  const apps = enterpriseApps(me);
  return (
    <AppShell
      productName={me.tenant.name}
      appName="Admin"
      version={import.meta.env['VITE_TENANTRY_VERSION'] as string | undefined}
      brandColor={branding?.primaryColor ?? null}
      headerActions={
        <>
          <WorkspaceSearch pages={nav} />
          <NotificationsBell workspaces={workspaces} />
        </>
      }
      logoUrl={branding?.logoUrl ?? null}
      apps={appLinks(workspaces, 'portal', { admin })}
      workspaces={workspaces.map(({ slug, name, current, portalUrl }) => ({
        slug,
        name,
        current,
        href: portalUrl,
      }))}
      navItems={nav}
      currentPath={pathname}
      linkAs={RouterLink}
      {...(onSignOut && me.user.email
        ? { user: { email: me.user.email, name: me.user.displayName ?? undefined, onSignOut } }
        : {})}
    >
      {!admin ? (
        <NotAllowedPage />
      ) : (
        <Routes>
          <Route path="/" element={first ? <Navigate replace to={first} /> : <NotAllowedPage />} />
          {me.can('members:invite') && <Route path="/people" element={<PeopleRoute />} />}
          {me.can('audit:read') && <Route path="/audit" element={<AuditRoute />} />}
          {settings && (
            <>
              <Route path="/branding" element={<BrandingRoute onChanged={reload} />} />
              <Route path="/security" element={<SecurityRoute />} />
              <Route path="/advanced/scim" element={<ScimRoute />} />
              <Route path="/scim" element={<Navigate replace to="/advanced/scim" />} />
            </>
          )}
          {apps && (
            <>
              <Route path="/advanced/apps" element={<ApplicationsRoute />} />
              <Route path="/advanced/apps/new" element={<RegisterAppRoute />} />
              <Route path="/advanced/apps/:id" element={<AppDetailRoute />} />
              {/* Registered redirect URIs name this path, so it stays where it was. */}
              <Route path="/applications/test-callback" element={<TestCallbackRoute />} />
              <Route path="/applications" element={<Navigate replace to="/advanced/apps" />} />
              <Route path="/applications/:id" element={<OldAppAddress />} />
            </>
          )}
          <Route path="*" element={<NotAllowedPage />} />
        </Routes>
      )}
    </AppShell>
  );
}

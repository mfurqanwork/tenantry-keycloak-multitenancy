import type { Permission } from '@tenantry/auth';
import { appLinks, canSeeAdmin, RouterLink, useBranding, useMe, useWorkspaces } from '@tenantry/app-kit';
import { AppShell, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { ApplicationsRoute } from './features/applications/ApplicationsRoute.js';
import { AppDetailRoute } from './features/applications/AppDetailRoute.js';
import { RegisterAppRoute } from './features/applications/RegisterAppRoute.js';
import { TestCallbackRoute } from './features/applications/TestCallbackRoute.js';
import { BrandingRoute } from './features/branding/BrandingRoute.js';
import { DashboardRoute } from './features/dashboard/DashboardRoute.js';
import { ScimRoute } from './features/scim/ScimRoute.js';
import { SecurityRoute } from './features/security/SecurityRoute.js';

// Each page and the permission that shows it; the API checks again on every call.
const PAGES: (NavItem & { needs?: Permission })[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Applications', href: '/applications', needs: 'apps:read' },
  { label: 'Branding', href: '/branding', needs: 'tenant:settings' },
  { label: 'Security', href: '/security', needs: 'tenant:settings' },
  { label: 'Directory sync (SCIM)', href: '/scim', needs: 'tenant:settings' },
];

// The workspace's admin console, once signed in. Root supplies the theme.
export function App({ onSignOut }: { onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const workspaces = useWorkspaces();
  const { branding, reload } = useBranding(me.tenant.slug);
  const enterprise = me.tenant.tier === 'enterprise';
  const nav = PAGES.filter((page) => !page.needs || me.can(page.needs)).map(({ label, href }) => ({
    label,
    href,
  }));
  return (
    <AppShell
      productName={me.tenant.name}
      logoUrl={branding?.logoUrl ?? null}
      apps={appLinks(workspaces, 'portal', { admin: canSeeAdmin(me.can) })}
      workspaces={workspaces.map(({ slug, name, current, portalUrl }) => ({
        slug,
        name,
        current,
        href: portalUrl,
      }))}
      navItems={nav}
      currentPath={pathname}
      linkAs={RouterLink}
      {...(onSignOut && me.user.email ? { user: { email: me.user.email, onSignOut } } : {})}
    >
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        {/* Every applications address answers: a Standard workspace, or someone who may not register,
            sees the list (or its Enterprise sentence) instead of an app called "new". */}
        {me.can('apps:read') && (
          <>
            <Route path="/applications" element={<ApplicationsRoute />} />
            <Route
              path="/applications/new"
              element={enterprise && me.can('apps:register') ? <RegisterAppRoute /> : <ApplicationsRoute />}
            />
            <Route
              path="/applications/test-callback"
              element={enterprise && me.can('apps:register') ? <TestCallbackRoute /> : <ApplicationsRoute />}
            />
            <Route
              path="/applications/:id"
              element={enterprise ? <AppDetailRoute /> : <ApplicationsRoute />}
            />
          </>
        )}
        {me.can('tenant:settings') && (
          <>
            <Route path="/branding" element={<BrandingRoute onChanged={reload} />} />
            <Route path="/security" element={<SecurityRoute />} />
            <Route path="/scim" element={<ScimRoute />} />
          </>
        )}
      </Routes>
    </AppShell>
  );
}

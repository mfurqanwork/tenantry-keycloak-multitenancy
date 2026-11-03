import type { Permission } from '@tenantry/auth';
import { appLinks, RouterLink, useBranding, useMe, useWorkspaces } from '@tenantry/app-kit';
import { AppShell, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { BrandingRoute } from './features/branding/BrandingRoute.js';
import { DashboardRoute } from './features/dashboard/DashboardRoute.js';

// Each page and the permission that shows it; the API checks again on every call.
const PAGES: (NavItem & { needs?: Permission })[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Branding', href: '/branding', needs: 'tenant:settings' },
];

// The workspace's admin console, once signed in. Root supplies the theme.
export function App({ onSignOut }: { onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const workspaces = useWorkspaces();
  const { branding, reload } = useBranding(me.tenant.slug);
  const nav = PAGES.filter((page) => !page.needs || me.can(page.needs)).map(({ label, href }) => ({
    label,
    href,
  }));
  return (
    <AppShell
      productName={me.tenant.name}
      logoUrl={branding?.logoUrl ?? null}
      apps={appLinks(workspaces, 'portal')}
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
        {me.can('tenant:settings') && (
          <Route path="/branding" element={<BrandingRoute onChanged={reload} />} />
        )}
      </Routes>
    </AppShell>
  );
}

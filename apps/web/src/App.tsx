import type { Permission } from '@tenantry/auth';
import { AppShell, type NavItem } from '@tenantry/ui';
import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { HomeRoute } from './features/home/HomeRoute.js';
import { PatternsRoute } from './features/patterns/PatternsRoute.js';
import { ProjectsRoute } from './features/projects/ProjectsRoute.js';
import {
  adminUrl,
  appLinks,
  canSeeAdmin,
  RouterLink,
  useBranding,
  useMe,
  useWorkspaces,
} from '@tenantry/app-kit';

// Tenantry is the product people use; the workspace itself is managed in Admin (ADR-0027).
const PAGES: (NavItem & { needs?: Permission })[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects', needs: 'projects:read' },
];

// Members and the audit log moved to Admin in Phase 6a; old bookmarks land there.
function ToAdmin({ path }: { path: string }) {
  const target = adminUrl(useWorkspaces(), path);
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);
  return null;
}

// The tenant app's shell and routes, once signed in. Root supplies the theme.
export function App({ onSignOut }: { onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const workspaces = useWorkspaces();
  const { branding } = useBranding(me.tenant.slug);
  const nav = PAGES.filter((page) => !page.needs || me.can(page.needs)).map(({ label, href }) => ({
    label,
    href,
  }));
  return (
    <AppShell
      productName={me.tenant.name}
      logoUrl={branding?.logoUrl ?? null}
      apps={appLinks(workspaces, 'web', { admin: canSeeAdmin(me.can) })}
      workspaces={workspaces.map(({ slug, name, current, webUrl }) => ({
        slug,
        name,
        current,
        href: webUrl,
      }))}
      navItems={nav}
      currentPath={pathname}
      linkAs={RouterLink}
      {...(onSignOut && me.user.email ? { user: { email: me.user.email, onSignOut } } : {})}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/projects" element={<ProjectsRoute />} />
        <Route path="/members" element={<ToAdmin path="/people" />} />
        <Route path="/audit" element={<ToAdmin path="/audit" />} />
        {/* The page-pattern gallery is a developer aid, not part of the product. */}
        {import.meta.env.DEV && <Route path="/patterns" element={<PatternsRoute />} />}
      </Routes>
    </AppShell>
  );
}

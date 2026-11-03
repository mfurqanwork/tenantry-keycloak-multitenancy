import type { Permission } from '@tenantry/auth';
import { AppShell, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { AuditRoute } from './features/audit/AuditRoute.js';
import { DashboardRoute } from './features/dashboard/DashboardRoute.js';
import { MembersRoute } from './features/members/MembersRoute.js';
import { PatternsRoute } from './features/patterns/PatternsRoute.js';
import { ProjectsRoute } from './features/projects/ProjectsRoute.js';
import { RouterLink, useMe } from '@tenantry/app-kit';

// Each page and the permission that shows it; the API checks again on every call.
const PAGES: (NavItem & { needs?: Permission })[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Projects', href: '/projects', needs: 'projects:read' },
  { label: 'Members', href: '/members', needs: 'members:read' },
  { label: 'Audit log', href: '/audit', needs: 'audit:read' },
  { label: 'Patterns', href: '/patterns' },
];

// The tenant app's shell and routes, once signed in. Root supplies the theme.
export function App({ hostname, onSignOut }: { hostname: string; onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const nav = PAGES.filter((page) => !page.needs || me.can(page.needs)).map(({ label, href }) => ({
    label,
    href,
  }));
  return (
    <AppShell
      productName="Tenantry"
      navItems={nav}
      currentPath={pathname}
      linkAs={RouterLink}
      {...(onSignOut && me.user.email ? { user: { email: me.user.email, onSignOut } } : {})}
    >
      <Routes>
        <Route path="/" element={<DashboardRoute hostname={hostname} />} />
        <Route path="/projects" element={<ProjectsRoute />} />
        <Route path="/members" element={<MembersRoute />} />
        <Route path="/audit" element={<AuditRoute />} />
        <Route path="/patterns" element={<PatternsRoute />} />
      </Routes>
    </AppShell>
  );
}

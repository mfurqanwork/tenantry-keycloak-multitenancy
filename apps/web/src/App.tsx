import { AppShell, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { DashboardRoute } from './features/dashboard/DashboardRoute.js';
import { PatternsRoute } from './features/patterns/PatternsRoute.js';
import { RouterLink } from './lib/RouterLink.js';

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Patterns', href: '/patterns' },
];

// The tenant app's shell and routes, once signed in. Root supplies the theme.
export function App({ hostname }: { hostname: string }) {
  const { pathname } = useLocation();
  return (
    <AppShell productName="Tenantry" navItems={NAV} currentPath={pathname} linkAs={RouterLink}>
      <Routes>
        <Route path="/" element={<DashboardRoute hostname={hostname} />} />
        <Route path="/patterns" element={<PatternsRoute />} />
      </Routes>
    </AppShell>
  );
}

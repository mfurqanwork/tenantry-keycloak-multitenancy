import { AppShell, TenantryThemeProvider, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { DashboardRoute } from './routes/DashboardRoute.js';
import { PatternsRoute } from './routes/PatternsRoute.js';

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Patterns', href: '/patterns' },
];

export function App({ hostname }: { hostname: string }) {
  const { pathname } = useLocation();
  return (
    <TenantryThemeProvider>
      <AppShell productName="Tenantry" navItems={NAV} currentPath={pathname}>
        <Routes>
          <Route path="/" element={<DashboardRoute hostname={hostname} />} />
          <Route path="/patterns" element={<PatternsRoute />} />
        </Routes>
      </AppShell>
    </TenantryThemeProvider>
  );
}

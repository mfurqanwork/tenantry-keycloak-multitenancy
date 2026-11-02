import { AppShell, TenantryThemeProvider, type NavItem } from '@tenantry/ui';
import { Route, Routes, useLocation } from 'react-router';
import { DashboardRoute } from './routes/DashboardRoute.js';

const NAV: NavItem[] = [{ label: 'Dashboard', href: '/' }];

export function App({ hostname }: { hostname: string }) {
  const { pathname } = useLocation();
  return (
    <TenantryThemeProvider>
      <AppShell productName="Tenantry Portal" navItems={NAV} currentPath={pathname}>
        <Routes>
          <Route path="/" element={<DashboardRoute hostname={hostname} />} />
        </Routes>
      </AppShell>
    </TenantryThemeProvider>
  );
}

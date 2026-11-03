import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';

const workspaces = [
  { slug: 'acme', name: 'Acme', href: 'http://acme.tenantry.localhost/', current: true },
  { slug: 'globex', name: 'Globex', href: 'http://globex.tenantry.localhost/', current: false },
];
const apps = [
  { label: 'Tenantry', href: 'http://acme.tenantry.localhost/', current: true },
  { label: 'Tenantry Portal', href: 'http://acme.portal.tenantry.localhost/', current: false },
];

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  render(
    <TenantryThemeProvider>
      <AppShell productName="Tenantry" navItems={[]} currentPath="/" {...props}>
        <p>content</p>
      </AppShell>
    </TenantryThemeProvider>,
  );
}

describe('header switchers', () => {
  it('lists every workspace and marks the current one', async () => {
    renderShell({ workspaces });
    await userEvent.click(screen.getByRole('button', { name: 'Switch workspace' }));
    const panel = screen.getByRole('navigation', { name: 'Switch workspace' });
    expect(within(panel).getByRole('link', { name: /Globex/ })).toHaveAttribute(
      'href',
      'http://globex.tenantry.localhost/',
    );
    expect(within(panel).getByRole('link', { name: /Acme/ })).toHaveAttribute('aria-current', 'page');
  });

  it('lists the apps with their addresses', async () => {
    renderShell({ apps });
    await userEvent.click(screen.getByRole('button', { name: 'Switch app' }));
    const panel = screen.getByRole('navigation', { name: 'Switch app' });
    expect(within(panel).getByRole('link', { name: /Tenantry Portal/ })).toHaveAttribute(
      'href',
      'http://acme.portal.tenantry.localhost/',
    );
  });

  it('shows no switcher with fewer than two entries', () => {
    renderShell({ workspaces: workspaces.slice(0, 1), apps: apps.slice(0, 1) });
    expect(screen.queryByRole('button', { name: 'Switch workspace' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch app' })).toBeNull();
  });

  it("shows the tenant's logo before the product name", () => {
    renderShell({ logoUrl: '/api/tenants/acme/logo?v=1' });
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('img.tenantry-header__logo')).toHaveAttribute(
      'src',
      '/api/tenants/acme/logo?v=1',
    );
  });
});

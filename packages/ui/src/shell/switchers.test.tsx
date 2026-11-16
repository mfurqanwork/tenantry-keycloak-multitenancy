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
const nav = [{ label: 'Home', href: '/' }];

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  render(
    <TenantryThemeProvider>
      <AppShell productName="Acme" navItems={nav} currentPath="/" {...props}>
        <p>content</p>
      </AppShell>
    </TenantryThemeProvider>,
  );
}

describe('switchers', () => {
  it('lists every workspace and marks the current one', async () => {
    renderShell({ workspaces });
    await userEvent.click(screen.getByRole('button', { name: 'Switch workspace' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Globex/ })).toHaveAttribute('href', 'http://globex.tenantry.localhost/');
    expect(within(menu).getByRole('menuitem', { name: /Acme/ })).toHaveAttribute('aria-current', 'page');
  });

  it('long workspace names truncate and keep the full name', async () => {
    const long = 'The Extremely Long Workspace Name Of A Very Large Company Ltd';
    expect(long.length).toBeGreaterThanOrEqual(60);
    const many = Array.from({ length: 30 }, (_, i) => ({
      slug: `w${String(i)}`,
      name: i === 0 ? long : `Workspace ${String(i)}`,
      href: `http://w${String(i)}.tenantry.localhost/`,
      current: i === 0,
    }));
    renderShell({ productName: long, workspaces: many });
    const trigger = screen.getByRole('button', { name: 'Switch workspace' });
    expect(trigger.querySelector('[title]')).toHaveAttribute('title', long);
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(30);
    expect(within(menu).getByRole('menuitem', { name: long })).toHaveAttribute('title', long);
    expect(menu.className).toMatch(/max-h-\S+/);
    expect(menu.className).toMatch(/overflow-y-auto/);
  });

  it('lists the apps with their addresses', async () => {
    renderShell({ apps });
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Switch app' }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Tenantry Portal/ })).toHaveAttribute(
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
    expect(screen.getByRole('complementary').querySelector('img')).toHaveAttribute('src', '/api/tenants/acme/logo?v=1');
  });
});

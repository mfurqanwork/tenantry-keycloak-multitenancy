import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Folder, House, Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';
import { TenantryMark } from './TenantryMark.js';

const wrapper = TenantryThemeProvider;

describe('AppShell, redesigned (spec §8.2)', () => {
  it("shows the workspace's first letter on its colour, its name and the app's name, without a logo", () => {
    render(
      <AppShell productName="Acme" appName="Admin" brandColor="#198038" navItems={[]} currentPath="/">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const badge = screen.getByTestId('workspace-badge');
    expect(badge).toHaveTextContent('A');
    expect(badge).toHaveStyle({ backgroundColor: '#198038' });
    const banner = within(screen.getByRole('banner'));
    expect(banner.getByText('Acme')).toBeInTheDocument();
    expect(banner.getByText('Admin')).toBeInTheDocument();
  });

  it("shows the workspace's logo instead of the letter when it has one", () => {
    render(
      <AppShell productName="Acme" appName="Admin" logoUrl="/api/tenants/acme/logo" navItems={[]} currentPath="/">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    expect(screen.queryByTestId('workspace-badge')).toBeNull();
    expect(screen.getByRole('banner').querySelector('img')).toHaveAttribute('src', '/api/tenants/acme/logo');
  });

  it('puts the header actions (search, notifications) in the top bar', () => {
    render(
      <AppShell productName="Acme" navItems={[]} currentPath="/" headerActions={<button type="button">Search</button>}>
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it("shows the person's initials on the account button, and the theme choice inside the account menu", async () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[{ label: 'Home', href: '/' }]}
        currentPath="/"
        user={{ email: 'ada@example.test', name: 'Ada Acme', onSignOut: vi.fn() }}
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const account = screen.getByRole('button', { name: 'Account' });
    expect(account).toHaveTextContent('AA');
    expect(within(screen.getByRole('complementary')).getByRole('button', { name: 'Account' })).toBe(account);
    await userEvent.setup().click(account);
    expect(within(screen.getByRole('menu')).getByText('Ada Acme')).toBeVisible();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument();
  });

  it('shows an icon on each menu item and groups items under their section', () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[
          { label: 'Home', href: '/', icon: House },
          { label: 'Projects', href: '/projects', icon: Folder },
          { label: 'People', href: 'http://acme.portal.test/people', icon: Users, section: 'Workspace', crossApp: true },
        ]}
        currentPath="/"
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const nav = within(screen.getByRole('navigation', { name: 'Side navigation' }));
    for (const name of ['Home', 'Projects', /People/]) {
      expect(nav.getByRole('link', { name }).querySelector('svg')).not.toBeNull();
    }
    const workspace = nav.getByRole('list', { name: 'Workspace' });
    expect(within(workspace).getByRole('link', { name: /People/ })).toHaveAttribute('href', 'http://acme.portal.test/people');
    expect(within(workspace).queryByRole('link', { name: 'Projects' })).toBeNull();
  });
});

describe('AppShell version', () => {
  const user = { email: 'ada@example.test', onSignOut: vi.fn() };

  it('shows the running version in the account menu', async () => {
    render(
      <AppShell productName="Acme" navItems={[]} currentPath="/" user={user} version="0.6.0">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Tenantry 0.6.0')).toBeInTheDocument();
  });

  it('shows nothing when there is no version', async () => {
    render(
      <AppShell productName="Acme" navItems={[]} currentPath="/" user={user}>
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.queryByText(/^Tenantry \d/)).toBeNull();
  });
});

describe('TenantryMark', () => {
  it('shows the light or dark artwork by the resolved theme', () => {
    const { container } = render(<TenantryMark variant="logo" />, { wrapper });
    const img = () => container.querySelector('img');
    expect(img()).toHaveAttribute('data-theme', 'light');
    const light = img()?.getAttribute('src');
    localStorage.setItem('tenantry.theme', 'dark');
    const { container: dark } = render(<TenantryMark variant="logo" />, { wrapper });
    expect(dark.querySelector('img')).toHaveAttribute('data-theme', 'dark');
    expect(dark.querySelector('img')?.getAttribute('src')).not.toBe(light);
  });

  it('is the mark alone by default, hidden from assistive tech', () => {
    const { container } = render(<TenantryMark />, { wrapper });
    expect(container.querySelector('img')).toHaveAttribute('data-variant', 'mark');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});

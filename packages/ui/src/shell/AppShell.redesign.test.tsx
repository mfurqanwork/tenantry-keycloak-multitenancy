import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Folder, Home, UserMultiple } from '@carbon/icons-react';
import { describe, expect, it, vi } from 'vitest';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';

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
      <AppShell productName="Acme" logoUrl="/api/tenants/acme/logo" navItems={[]} currentPath="/">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    expect(screen.queryByTestId('workspace-badge')).toBeNull();
    expect(document.querySelector('.tenantry-header__logo')).toHaveAttribute('src', '/api/tenants/acme/logo');
  });

  it('puts the header actions (search, notifications) in the global bar', () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[]}
        currentPath="/"
        headerActions={<button type="button">Search</button>}
      >
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
        navItems={[]}
        currentPath="/"
        user={{ email: 'ada@example.test', name: 'Ada Acme', onSignOut: vi.fn() }}
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const account = screen.getByRole('button', { name: 'Account' });
    expect(account).toHaveTextContent('AA');
    // Three theme buttons no longer crowd the header.
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Dark theme' })).toBeNull();
    await userEvent.setup().click(account);
    expect(screen.getByText('Ada Acme')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
  });

  it('shows an icon on each menu item and groups items under their section', () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[
          { label: 'Home', href: '/', icon: Home },
          { label: 'Projects', href: '/projects', icon: Folder },
          {
            label: 'People',
            href: 'http://acme.portal.test/people',
            icon: UserMultiple,
            section: 'Workspace',
          },
        ]}
        currentPath="/"
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const nav = within(screen.getByRole('navigation', { name: 'Side navigation' }));
    expect(nav.getByText('Workspace')).toBeInTheDocument();
    for (const name of ['Home', 'Projects', 'People']) {
      expect(nav.getByRole('link', { name }).querySelector('svg')).not.toBeNull();
    }
    const items = nav.getAllByRole('listitem').map((li) => li.textContent);
    expect(items.indexOf('Workspace')).toBeLessThan(items.indexOf('People'));
    expect(items.indexOf('Projects')).toBeLessThan(items.indexOf('Workspace'));
  });
});

describe('AppShell version', () => {
  const user = { email: 'ada@example.test', onSignOut: vi.fn() };

  it('shows the running version in the account panel', async () => {
    render(
      <AppShell productName="Acme" navItems={[]} currentPath="/" user={user} version="0.6.0">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /account/i }));
    expect(screen.getByText('Tenantry 0.6.0')).toBeInTheDocument();
  });

  it('shows nothing when there is no version', async () => {
    render(
      <AppShell productName="Acme" navItems={[]} currentPath="/" user={user}>
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /account/i }));
    expect(screen.queryByText(/^Tenantry \d/)).toBeNull();
  });
});

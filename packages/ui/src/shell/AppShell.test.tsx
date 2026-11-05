import { render, screen } from '@testing-library/react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stubColorScheme } from '../test/setup.js';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';

const wrapper = TenantryThemeProvider;

const nav = [
  { label: 'Dashboard', href: '/' },
  { label: 'Patterns', href: '/patterns' },
];

function renderShell() {
  render(
    <TenantryThemeProvider>
      <AppShell productName="Tenantry" navItems={nav} currentPath="/patterns">
        <p>content</p>
      </AppShell>
    </TenantryThemeProvider>,
  );
}

describe('AppShell', () => {
  it.each([false, true])('keeps the header dark when the OS is dark=%s', (dark) => {
    stubColorScheme(dark);
    renderShell();
    expect(screen.getByRole('banner').closest('.cds--g100')).not.toBeNull();
  });

  it('puts the content in the main landmark', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('marks the current page in the side nav', () => {
    renderShell();
    const links = screen.getAllByRole('link', { name: 'Patterns' });
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(
      screen.getAllByRole('link', { name: 'Dashboard' }).every((l) => !l.hasAttribute('aria-current')),
    ).toBe(true);
  });

  it('shows the product name', () => {
    renderShell();
    expect(screen.getByRole('banner')).toHaveTextContent('Tenantry');
  });

  it('shows the signed-in user and signs out from the account menu', async () => {
    const onSignOut = vi.fn();
    render(
      <TenantryThemeProvider>
        <AppShell
          productName="Tenantry"
          navItems={nav}
          currentPath="/"
          user={{ email: 'ada@example.com', onSignOut }}
        >
          <p>content</p>
        </AppShell>
      </TenantryThemeProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('ada@example.com')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('has no account menu without a user', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('renders navigation through the link component it is given', () => {
    const TestLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
      <a ref={ref} data-router-link="" {...props} />
    ));
    render(
      <TenantryThemeProvider>
        <AppShell productName="Tenantry" navItems={nav} currentPath="/" linkAs={TestLink}>
          <p>content</p>
        </AppShell>
      </TenantryThemeProvider>,
    );
    const links = screen.getAllByRole('link', { name: 'Patterns' });
    expect(links.some((link) => link.hasAttribute('data-router-link'))).toBe(true);
  });

  it('renders a group collapsed, opening on click', async () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[
          {
            label: 'Advanced',
            href: '#advanced',
            children: [{ label: 'Directory sync', href: '/advanced/scim' }],
          },
        ]}
        currentPath="/"
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const group = screen.getByRole('button', { name: 'Advanced' });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Directory sync' })).toBeVisible();
  });

  it('opens the group that holds the current page', () => {
    render(
      <AppShell
        productName="Acme"
        navItems={[
          {
            label: 'Advanced',
            href: '#advanced',
            children: [{ label: 'Directory sync', href: '/advanced/scim' }],
          },
        ]}
        currentPath="/advanced/scim"
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Directory sync' })).toHaveAttribute('aria-current', 'page');
  });

  it('an external item opens in a new tab, without the router link', () => {
    const routed: unknown[] = [];
    const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
      (props, ref) => {
        routed.push(props.href);
        return <a ref={ref} {...props} />;
      },
    );
    render(
      <AppShell
        productName="Acme"
        navItems={[
          { label: 'Keycloak console', href: 'http://auth.test/admin/ent-acme/console/', external: true },
        ]}
        currentPath="/"
        linkAs={RouterLink}
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const link = screen.getByRole('link', { name: /Keycloak console/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(routed).not.toContain('http://auth.test/admin/ent-acme/console/');
  });

  it('shows the Tenantry mark without a workspace logo, and the workspace logo instead of it', () => {
    const { container, rerender } = render(
      <AppShell productName="Acme" navItems={[]} currentPath="/">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const mark = () => container.querySelector('.tenantry-header__logo');
    // Vite inlines the small SVG; either way it is the mark, with its one blue tile.
    expect(decodeURIComponent(mark()?.getAttribute('src') ?? '')).toMatch(/tenantry-mark|#0f62fe/);
    rerender(
      <AppShell productName="Acme" navItems={[]} currentPath="/" logoUrl="/api/tenants/acme/logo">
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    expect(container.querySelectorAll('.tenantry-header__logo')).toHaveLength(1);
    expect(mark()).toHaveAttribute('src', '/api/tenants/acme/logo');
  });
});

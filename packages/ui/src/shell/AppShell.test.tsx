import { render, screen, within } from '@testing-library/react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stubColorScheme } from '../test/setup.js';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';

const wrapper = TenantryThemeProvider;

const nav = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
];

function renderShell() {
  render(
    <AppShell productName="Tenantry" navItems={nav} currentPath="/projects">
      <p>content</p>
    </AppShell>,
    { wrapper },
  );
}

const sideNav = () => within(screen.getByRole('navigation', { name: 'Side navigation' }));

describe('AppShell', () => {
  it.each([false, true])('the header follows the page theme when the OS is dark=%s', (dark) => {
    stubColorScheme(dark);
    renderShell();
    expect(document.documentElement.classList.contains('dark')).toBe(dark);
    expect(screen.getByRole('banner').closest('body .dark, [data-theme]')).toBeNull();
    stubColorScheme(false);
  });

  it('shows the signed-in user and signs out from the account menu', async () => {
    const onSignOut = vi.fn();
    render(
      <AppShell
        productName="Tenantry"
        navItems={nav}
        currentPath="/"
        user={{ email: 'ada@example.com', onSignOut }}
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(within(screen.getByRole('menu')).getByText('ada@example.com')).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('theme menu sets the preference', async () => {
    render(
      <AppShell
        productName="Tenantry"
        navItems={nav}
        currentPath="/"
        user={{ email: 'ada@example.com', onSignOut: vi.fn() }}
      >
        <p>content</p>
      </AppShell>,
      { wrapper },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('tenantry.theme')).toBe('dark');
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
    expect(sideNav().getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true');
    expect(sideNav().getByRole('link', { name: 'Directory sync' })).toHaveAttribute('aria-current', 'page');
  });

  it('an external item opens in a new tab, without the router link, marked as leaving', () => {
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
    const link = sideNav().getByRole('link', { name: /Keycloak console/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link.querySelector('[data-slot="leaves-app"]')).not.toBeNull();
    expect(routed).not.toContain('http://auth.test/admin/ent-acme/console/');
  });

  it('phone drawer traps and returns focus', async () => {
    renderShell();
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Open menu' });
    await user.click(button);
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });
});

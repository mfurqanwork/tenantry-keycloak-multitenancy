import { render, screen } from '@testing-library/react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stubColorScheme } from '../test/setup.js';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { AppShell } from './AppShell.js';

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
});

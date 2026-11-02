import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TenantryThemeProvider } from '@tenantry/ui';
import { App } from './App.js';

function renderAt(path: string) {
  render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <App hostname="demo.tenantry.localhost" />
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}

describe('web app', () => {
  it('shows the dashboard with the tenant slug from the subdomain', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
    expect(screen.getByText('platform')).toBeInTheDocument();
  });

  it('shows every page pattern on /patterns', () => {
    renderAt('/patterns');
    for (const name of ['List page', 'Detail page', 'Settings page', 'Dashboard', 'Wizard']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('marks the current page in the side nav', () => {
    renderAt('/patterns');
    const links = screen.getAllByRole('link', { name: 'Patterns' });
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });
});

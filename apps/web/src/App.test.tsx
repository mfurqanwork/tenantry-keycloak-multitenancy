import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TenantryThemeProvider } from '@tenantry/ui';
import { App } from './App.js';
import { ApiProvider, type Me, MeProvider } from '@tenantry/app-kit';
import { ALL, fakeApi, makeMe, MEMBER } from './test-utils.js';

function renderAt(path: string, me: Me = makeMe('owner', ALL)) {
  render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ApiProvider api={fakeApi()}>
          <MeProvider value={me}>
            <App hostname="demo.tenantry.localhost" />
          </MeProvider>
        </ApiProvider>
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}

const renderAs = (me: Me) => {
  renderAt('/', me);
};

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

  it('shows only the pages the role allows in the side nav', () => {
    renderAs(makeMe('member', MEMBER));
    expect(screen.getAllByRole('link', { name: 'Projects' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Members' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
  });

  it('shows the audit log to an owner', () => {
    renderAs(makeMe('owner', ALL));
    expect(screen.getAllByRole('link', { name: 'Audit log' }).length).toBeGreaterThan(0);
  });
});

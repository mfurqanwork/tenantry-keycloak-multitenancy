import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TenantryThemeProvider } from '@tenantry/ui';
import { App } from './App.js';
import { ApiProvider, type Me, MeProvider } from '@tenantry/app-kit';
import { ALL, fakeApi, makeMe, MEMBER } from './test-utils.js';

const WORKSPACES = [
  {
    slug: 'acme',
    name: 'Acme',
    current: true,
    webUrl: 'http://acme.tenantry.localhost/',
    portalUrl: 'http://acme.portal.tenantry.localhost/',
  },
  {
    slug: 'globex',
    name: 'Globex',
    current: false,
    webUrl: 'http://globex.tenantry.localhost/',
    portalUrl: 'http://globex.portal.tenantry.localhost/',
  },
];

function renderAt(path: string, me: Me = makeMe('owner', ALL)) {
  render(
    <TenantryThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ApiProvider
          api={fakeApi({
            '/api/me/workspaces': WORKSPACES,
            '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
          })}
        >
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

  it("lists the person's workspaces, each at its web address", async () => {
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Switch workspace' }));
    const panel = screen.getByRole('navigation', { name: 'Switch workspace' });
    expect(within(panel).getByRole('link', { name: /Globex/ })).toHaveAttribute(
      'href',
      'http://globex.tenantry.localhost/',
    );
  });

  it('switches to the portal of this workspace', async () => {
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Switch app' }));
    const panel = screen.getByRole('navigation', { name: 'Switch app' });
    expect(within(panel).getByRole('link', { name: /Tenantry Portal/ })).toHaveAttribute(
      'href',
      'http://acme.portal.tenantry.localhost/',
    );
  });
});

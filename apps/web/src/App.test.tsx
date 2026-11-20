import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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
            '/api/projects': { projects: [] },
            '/api/members': { members: [], invites: [] },
          })}
        >
          <MeProvider value={me}>
            <App />
          </MeProvider>
        </ApiProvider>
      </MemoryRouter>
    </TenantryThemeProvider>,
  );
}

describe('web app (Tenantry, ADR-0027)', () => {
  it("shares one menu with Admin: an owner's Workspace pages open Admin (spec 8.1)", async () => {
    renderAt('/');
    const menu = () => within(screen.getByRole('navigation', { name: 'Side navigation' }));
    await waitFor(() => {
      expect(menu().getByRole('link', { name: 'People' })).toHaveAttribute(
        'href',
        'http://acme.portal.tenantry.localhost/people',
      );
    });
    expect(menu().getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(menu().getByText('Workspace')).toBeInTheDocument();
  });

  it('gives a member Home and Projects only', async () => {
    renderAt('/', makeMe('member', MEMBER));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
      ).toBeInTheDocument();
    });
    const menu = within(screen.getByRole('navigation', { name: 'Side navigation' }));
    expect(menu.getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Projects']);
  });

  it.each([
    ['/members', 'http://acme.portal.tenantry.localhost/people'],
    ['/audit', 'http://acme.portal.tenantry.localhost/audit'],
  ])('sends the old address %s to Admin', async (path, target) => {
    const replace = vi.fn();
    const realLocation = window.location;
    vi.stubGlobal('location', { href: realLocation.href, pathname: realLocation.pathname, replace });
    try {
      renderAt(path);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(target);
      });
    } finally {
      vi.stubGlobal('location', realLocation);
    }
  });

  it('answers an unknown address with page not found and a way back Home', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
  });

  it('keeps the patterns page out of production builds', () => {
    vi.stubEnv('DEV', false);
    renderAt('/patterns');
    vi.unstubAllEnvs();
    expect(screen.queryByRole('heading', { level: 2, name: 'List page' })).not.toBeInTheDocument();
  });
});

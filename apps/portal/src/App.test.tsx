import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { ADMIN, fakeApi, makeMe, OWNER, renderPortal, WORKSPACES } from './test-utils.js';

const api = () =>
  fakeApi({
    '/api/me/workspaces': WORKSPACES,
    '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
  });

describe('portal app', () => {
  it("shows the workspace's dashboard with the person's role", async () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER) });
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Acme');
    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });
  });

  it('shows Branding to owners only', () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER) });
    expect(screen.getAllByRole('link', { name: 'Branding' }).length).toBeGreaterThan(0);
  });

  it('shows Applications to everyone who may read apps, and opens the list', async () => {
    const routes = fakeApi({
      '/api/apps': { apps: [] },
      '/api/me/workspaces': WORKSPACES,
      '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
    });
    renderPortal(<App />, { api: routes, me: makeMe('member', ['apps:read']), path: '/applications' });
    expect(screen.getAllByRole('link', { name: 'Applications' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('No apps yet.')).toBeInTheDocument();
  });

  it('sends a member who opens the register address to the list, never to an app called "new"', async () => {
    const routes = fakeApi({
      '/api/apps': { apps: [] },
      '/api/me/workspaces': WORKSPACES,
      '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
    });
    renderPortal(<App />, { api: routes, me: makeMe('member', ['apps:read']), path: '/applications/new' });
    expect(await screen.findByText('No apps yet.')).toBeInTheDocument();
    expect(routes.get).not.toHaveBeenCalledWith('/api/apps/new');
  });

  it('shows a Standard workspace the Enterprise sentence on any applications address', () => {
    const me = makeMe('owner', ['apps:read', 'apps:register']);
    renderPortal(<App />, {
      api: api(),
      me: { ...me, tenant: { ...me.tenant, tier: 'standard' } },
      path: '/applications/a1',
    });
    expect(screen.getByText('Applications are available on Enterprise workspaces.')).toBeInTheDocument();
  });

  it('hides Branding from admins', () => {
    renderPortal(<App />, { api: api(), me: makeMe('admin', ADMIN) });
    expect(screen.queryByRole('link', { name: 'Branding' })).not.toBeInTheDocument();
  });

  it("switches to another workspace's portal, and to this workspace's web app", async () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER) });
    await userEvent.click(await screen.findByRole('button', { name: 'Switch workspace' }));
    expect(
      within(screen.getByRole('navigation', { name: 'Switch workspace' })).getByRole('link', {
        name: /Globex/,
      }),
    ).toHaveAttribute('href', 'http://globex.portal.tenantry.localhost/');
    await userEvent.click(screen.getByRole('button', { name: 'Switch app' }));
    expect(
      within(screen.getByRole('navigation', { name: 'Switch app' })).getByRole('link', {
        name: /^Tenantry$/,
      }),
    ).toHaveAttribute('href', 'http://acme.tenantry.localhost/');
  });

  it("links to this workspace's web app from the dashboard", async () => {
    renderPortal(<App />, { api: api(), me: makeMe('admin', ADMIN) });
    expect(await screen.findByRole('link', { name: 'Open Tenantry' })).toHaveAttribute(
      'href',
      'http://acme.tenantry.localhost/',
    );
  });
});

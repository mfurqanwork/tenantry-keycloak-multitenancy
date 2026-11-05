import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { ADMIN, fakeApi, makeMe, MEMBER, OWNER, renderPortal, WORKSPACES } from './test-utils.js';

const api = () =>
  fakeApi({
    '/api/me/workspaces': WORKSPACES,
    '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
    '/api/members': { members: [], invites: [] },
    '/api/audit': { entries: [], nextCursor: null },
    '/api/apps': { apps: [] },
    '/api/security': {},
    '/api/scim': { url: 'http://acme.tenantry.localhost/scim/v2', token: null, defaultRole: 'member' },
  });

const enterprise = (me: ReturnType<typeof makeMe>) => ({
  ...me,
  tenant: { ...me.tenant, tier: 'enterprise' as const },
});
const standard = (me: ReturnType<typeof makeMe>) => ({
  ...me,
  tenant: { ...me.tenant, tier: 'standard' as const },
});
const menu = () => screen.getByRole('navigation', { name: 'Side navigation' });

describe('Admin (ADR-0027)', () => {
  it('an owner sees People, Branding, Sign-in & security, Audit log and Advanced', () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER) });
    for (const name of ['People', 'Branding', 'Sign-in & security', 'Audit log']) {
      expect(within(menu()).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(menu()).getByRole('button', { name: 'Advanced' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('Advanced holds Directory sync, and Customer apps on Enterprise', async () => {
    renderPortal(<App />, { api: api(), me: enterprise(makeMe('owner', OWNER)) });
    await userEvent.click(within(menu()).getByRole('button', { name: 'Advanced' }));
    expect(within(menu()).getByRole('link', { name: 'Directory sync (SCIM)' })).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Customer apps' })).toBeInTheDocument();
  });

  it('a Standard workspace has no Customer apps', async () => {
    renderPortal(<App />, { api: api(), me: standard(makeMe('owner', OWNER)) });
    await userEvent.click(within(menu()).getByRole('button', { name: 'Advanced' }));
    expect(within(menu()).queryByRole('link', { name: 'Customer apps' })).not.toBeInTheDocument();
  });

  it('an admin of a Standard workspace sees People and Audit log only', () => {
    renderPortal(<App />, { api: api(), me: standard(makeMe('admin', ADMIN)) });
    expect(within(menu()).getByRole('link', { name: 'People' })).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
    expect(within(menu()).queryByRole('link', { name: 'Branding' })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
  });

  it('a member sees the not-allowed page at /people and no menu entries', () => {
    renderPortal(<App />, { api: api(), me: makeMe('member', MEMBER), path: '/people' });
    expect(screen.getByRole('heading', { level: 1, name: "You can't open Admin" })).toBeInTheDocument();
    expect(within(menu()).queryAllByRole('link')).toHaveLength(0);
  });

  it('opens on People for an owner', async () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER), path: '/' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    });
  });

  it.each([
    ['/applications', 'Customer apps'],
    ['/scim', 'Directory sync (SCIM)'],
  ])('redirects the old address %s', async (path, title) => {
    renderPortal(<App />, { api: api(), me: enterprise(makeMe('owner', OWNER)), path });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    });
  });

  it('redirects an old app address to its new one', async () => {
    const routes = api();
    renderPortal(<App />, { api: routes, me: enterprise(makeMe('owner', OWNER)), path: '/applications/a1' });
    await waitFor(() => {
      expect(routes.get).toHaveBeenCalledWith('/api/apps/a1');
    });
  });

  it('the test callback keeps its path', () => {
    renderPortal(<App />, {
      api: api(),
      me: enterprise(makeMe('owner', OWNER)),
      path: '/applications/test-callback',
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Test sign-in' })).toBeInTheDocument();
  });

  it('links to the Keycloak console only for someone with console access', async () => {
    const me = enterprise(makeMe('owner', OWNER));
    const { unmount } = renderPortal(<App />, { api: api(), me });
    await userEvent.click(within(menu()).getByRole('button', { name: 'Advanced' }));
    expect(within(menu()).queryByRole('link', { name: /Keycloak console/ })).not.toBeInTheDocument();
    unmount();
    renderPortal(<App />, {
      api: api(),
      me: { ...me, consoleUrl: 'http://auth.test/admin/ent-acme/console/' },
    });
    await userEvent.click(within(menu()).getByRole('button', { name: 'Advanced' }));
    expect(within(menu()).getByRole('link', { name: /Keycloak console/ })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('/people?invite=1 opens the invite dialog', async () => {
    renderPortal(<App />, { api: api(), me: makeMe('owner', OWNER), path: '/people?invite=1' });
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Invite/ })).toBeInTheDocument();
    });
  });

  it("switches to another workspace's Admin, and to this workspace's Tenantry", async () => {
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
});

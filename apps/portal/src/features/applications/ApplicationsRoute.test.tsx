import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, renderPortal } from '../../test-utils.js';
import { ApplicationsRoute } from './ApplicationsRoute.js';
import { sampleApp } from './test-data.js';

const ADMIN = makeMe('admin', ['apps:read', 'apps:register']);
const MEMBER = makeMe('member', ['apps:read']);

describe('ApplicationsRoute', () => {
  it('lists the apps with their type and client id, each linking to its page', async () => {
    const api = fakeApi({
      '/api/apps': {
        apps: [
          sampleApp({ type: 'web' }),
          sampleApp({ id: 'a2', name: 'Sync', type: 'm2m', clientId: 'app-22222222' }),
        ],
      },
    });
    renderPortal(<ApplicationsRoute />, { api, me: ADMIN, path: '/advanced/apps' });
    expect(await screen.findByRole('link', { name: 'HR portal' })).toHaveAttribute(
      'href',
      '/advanced/apps/a1',
    );
    expect(screen.getByText('Web app')).toBeInTheDocument();
    expect(screen.getByText('Machine to machine')).toBeInTheDocument();
    expect(screen.getByText('app-22222222')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register an app' })).toHaveAttribute(
      'href',
      '/advanced/apps/new',
    );
  });

  it('apps list shows the type icon', async () => {
    const api = fakeApi({
      '/api/apps': {
        apps: [
          sampleApp({ id: 'a1', name: 'Web', type: 'web' }),
          sampleApp({ id: 'a2', name: 'Spa', type: 'spa' }),
          sampleApp({ id: 'a3', name: 'Phone', type: 'native' }),
          sampleApp({ id: 'a4', name: 'Sync', type: 'm2m' }),
        ],
      },
    });
    renderPortal(<ApplicationsRoute />, { api, me: ADMIN, path: '/advanced/apps' });
    await screen.findByRole('link', { name: 'Web' });
    const kinds = ['Web app', 'Single-page app', 'Mobile or desktop app', 'Machine to machine'].map((label) => {
      const cell = screen.getByText(label).closest('td') as HTMLElement;
      return within(cell).getByText(label).parentElement?.querySelector('svg')?.getAttribute('data-type');
    });
    expect(kinds).toEqual(['web', 'spa', 'native', 'm2m']);
    expect(document.querySelector('[class*="cds--"]')).toBeNull();
  });

  it('invites admins to register the first app, and only tells members there is none', async () => {
    renderPortal(<ApplicationsRoute />, {
      api: fakeApi({ '/api/apps': { apps: [] } }),
      me: ADMIN,
      path: '/advanced/apps',
    });
    expect(await screen.findByText('Register one to connect it to your sign-in.')).toBeInTheDocument();
  });

  it('shows members the list without the register action', async () => {
    renderPortal(<ApplicationsRoute />, {
      api: fakeApi({ '/api/apps': { apps: [] } }),
      me: MEMBER,
      path: '/advanced/apps',
    });
    expect(await screen.findByText('Owners and admins register apps here.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Register an app' })).not.toBeInTheDocument();
  });

  it('explains that Standard workspaces have no apps, without asking the API', () => {
    const me = makeMe('owner', ['apps:read', 'apps:register']);
    const api = fakeApi();
    renderPortal(<ApplicationsRoute />, {
      api,
      me: { ...me, tenant: { ...me.tenant, tier: 'standard' } },
      path: '/advanced/apps',
    });
    expect(screen.getByText('Applications are available on Enterprise workspaces.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});

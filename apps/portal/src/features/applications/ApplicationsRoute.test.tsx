import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, renderPortal } from '../../test-utils.js';
import { ApplicationsRoute } from './ApplicationsRoute.js';
import { sampleApp } from './test-data.js';

const ADMIN = makeMe('admin', ['apps:read', 'apps:register']);
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

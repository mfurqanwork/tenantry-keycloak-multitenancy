import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ALL, fakeApi, makeMe, MEMBER, renderPage } from '../../test-utils.js';
import { HomeRoute } from './HomeRoute.js';

const WORKSPACES = [
  {
    slug: 'acme',
    name: 'Acme',
    current: true,
    webUrl: 'http://acme.tenantry.localhost/',
    portalUrl: 'http://acme.portal.tenantry.localhost/',
  },
];
const project = (n: number) => ({
  id: `p${n}`,
  name: `Project ${n}`,
  createdAt: `2026-11-0${n}T00:00:00.000Z`,
});

const api = (projects: unknown[] = [], extra: Record<string, unknown> = {}) =>
  fakeApi({
    '/api/projects': { projects },
    '/api/members': { members: [{ userId: 'u-me' }], invites: [] },
    '/api/me/workspaces': WORKSPACES,
    '/api/tenants/acme/branding': { name: 'Acme', primaryColor: null, logoUrl: null },
    ...extra,
  });

describe('Home', () => {
  it('shows a new workspace its checklist, with each step from live data', async () => {
    renderPage(<HomeRoute />, {
      api: api([], {
        '/api/tenants/acme/branding': { name: 'Acme', primaryColor: '#198038', logoUrl: null },
      }),
      me: makeMe('owner', ALL),
    });
    expect(await screen.findByRole('region', { name: 'Get started' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Add your colour and logo').closest('li')).toHaveAttribute('data-done', 'true');
    });
    expect(screen.getByText('Create a project').closest('li')).toHaveAttribute('data-done', 'false');
    expect(await screen.findByRole('link', { name: 'Invite a teammate' })).toHaveAttribute(
      'href',
      'http://acme.portal.tenantry.localhost/people?invite=1',
    );
  });

  it('counts an open invite as inviting a teammate', async () => {
    renderPage(<HomeRoute />, {
      api: api([], { '/api/members': { members: [{ userId: 'u-me' }], invites: [{ id: 'i1' }] } }),
      me: makeMe('owner', ALL),
    });
    await waitFor(() => {
      expect(screen.getByText('Invite a teammate').closest('li')).toHaveAttribute('data-done', 'true');
    });
  });

  it('creates the first project from Home, and marks the step done', async () => {
    const routes = api();
    renderPage(<HomeRoute />, { api: routes, me: makeMe('owner', ALL) });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Project name'), 'Launch{Enter}');
    expect(routes.post).toHaveBeenCalledWith('/api/projects', { name: 'Launch' });
  });

  it('shows a member no checklist, only the five most recent projects', async () => {
    renderPage(<HomeRoute />, { api: api([1, 2, 3, 4, 5, 6].map(project)), me: makeMe('member', MEMBER) });
    expect(await screen.findByText('Project 6')).toBeInTheDocument();
    expect(screen.queryByText('Project 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Get started' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
  });

  it('says so when there are no projects yet', async () => {
    renderPage(<HomeRoute />, { api: api(), me: makeMe('member', MEMBER) });
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
  });
});

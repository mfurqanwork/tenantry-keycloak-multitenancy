import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, MEMBER, renderPage } from '../../test-utils.js';
import { ProjectsRoute } from './ProjectsRoute.js';

describe('ProjectsRoute', () => {
  it('shows the empty state, then creates a project', async () => {
    const api = fakeApi({
      '/api/projects': { projects: [] },
      'POST /api/projects': { id: 'p1', name: 'Apollo', createdAt: '2026-11-02T10:00:00Z' },
    });
    renderPage(<ProjectsRoute />, { api, me: makeMe('member', MEMBER) });
    expect(await screen.findByRole('heading', { name: 'Start your first project' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create project' });
    await user.type(within(dialog).getByLabelText('Name'), 'Apollo');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/projects', { name: 'Apollo' });
    });
  });

  it('lists projects', async () => {
    renderPage(<ProjectsRoute />, {
      api: fakeApi({
        '/api/projects': { projects: [{ id: 'p1', name: 'Apollo', createdAt: '2026-11-02T10:00:00Z' }] },
      }),
      me: makeMe('member', MEMBER),
    });
    const table = await screen.findByRole('table', { name: 'Projects' });
    expect(table).toHaveTextContent('Apollo');
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });

  it('projects search filters rows', async () => {
    renderPage(<ProjectsRoute />, {
      api: fakeApi({
        '/api/projects': {
          projects: [
            { id: 'p1', name: 'Apollo', createdAt: '2026-11-02T10:00:00Z' },
            { id: 'p2', name: 'Gemini', createdAt: '2026-11-03T10:00:00Z' },
          ],
        },
      }),
      me: makeMe('member', MEMBER),
    });
    const table = await screen.findByRole('table', { name: 'Projects' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search projects' }), 'gem');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(table).toHaveTextContent('Gemini');
    expect(table).not.toHaveTextContent('Apollo');
  });
});

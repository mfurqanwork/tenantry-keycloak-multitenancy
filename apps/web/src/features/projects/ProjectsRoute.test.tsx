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
    await user.click(screen.getByRole('button', { name: 'Create project' }));
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
    expect(await screen.findByText('Apollo')).toBeInTheDocument();
  });

  it('has its icon and a line on what it is for', async () => {
    renderPage(<ProjectsRoute />, {
      api: fakeApi({ '/api/projects': { projects: [] } }),
      me: makeMe('member', MEMBER),
    });
    const title = await screen.findByRole('heading', { level: 1, name: 'Projects' });
    expect(title.querySelector('svg')).not.toBeNull();
    expect(screen.getByText("Your team's work, kept to this workspace.")).toBeInTheDocument();
  });

  it('filters the list as you type, starting from the address (search results)', async () => {
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
      path: '/projects?q=gem',
    });
    expect(await screen.findByText('Gemini')).toBeInTheDocument();
    expect(screen.queryByText('Apollo')).toBeNull();
    const search = screen.getByRole('searchbox', { name: 'Search projects' });
    expect(search).toHaveValue('gem');
    const user = userEvent.setup();
    await user.clear(search);
    await user.type(search, 'apo');
    expect(screen.getByText('Apollo')).toBeInTheDocument();
    expect(screen.queryByText('Gemini')).toBeNull();
  });
});

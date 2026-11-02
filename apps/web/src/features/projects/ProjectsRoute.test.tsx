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
    expect(await screen.findByText('No projects yet. Create one to get started.')).toBeInTheDocument();
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
});

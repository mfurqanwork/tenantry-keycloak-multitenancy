import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ALL, fakeApi, makeMe, renderPage } from '../../test-utils.js';
import { AuditRoute } from './AuditRoute.js';

const entry = (id: string, action: string) => ({
  id,
  action,
  target: 't',
  metadata: {},
  createdAt: '2026-11-02T10:00:00Z',
  actor: { id: 'u-me', email: 'me@example.com' },
});

describe('AuditRoute', () => {
  it('shows entries in the order the API gives them, newest first', async () => {
    renderPage(<AuditRoute />, {
      api: fakeApi({
        '/api/audit': {
          entries: [entry('2', 'project.created'), entry('1', 'tenant.created')],
          nextBefore: null,
        },
      }),
      me: makeMe('owner', ALL),
    });
    await screen.findByText('project.created');
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('project.created');
    expect(rows[2]).toHaveTextContent('tenant.created');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('loads the next page', async () => {
    const api = fakeApi({
      '/api/audit': { entries: [entry('2', 'project.created')], nextBefore: '2' },
      '/api/audit?before=2': { entries: [entry('1', 'tenant.created')], nextBefore: null },
    });
    renderPage(<AuditRoute />, { api, me: makeMe('owner', ALL) });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('tenant.created')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });
  });
});

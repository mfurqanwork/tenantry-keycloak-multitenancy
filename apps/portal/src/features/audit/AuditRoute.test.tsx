import { act, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL, fakeApi, makeMe, renderPage } from '../../test-utils.js';
import { AuditRoute } from './AuditRoute.js';

const entry = (id: string, action: string, targetLabel: string | null = null) => ({
  id,
  action,
  target: 't-raw-id',
  targetLabel,
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

  it('names the target, falling back to its id', async () => {
    renderPage(<AuditRoute />, {
      api: fakeApi({
        '/api/audit': {
          entries: [entry('2', 'member.invited', 'bob@example.com'), entry('1', 'tenant.created')],
          nextBefore: null,
        },
      }),
      me: makeMe('owner', ALL),
    });
    expect(await screen.findByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('t-raw-id')).toBeInTheDocument();
  });

  it('shows that the next page is loading', async () => {
    let finish: (v: unknown) => void = () => undefined;
    // The first page answers at once; the next one waits until the test lets it finish.
    const get = (path: string) =>
      path === '/api/audit'
        ? Promise.resolve({ entries: [entry('2', 'project.created')], nextBefore: '2' })
        : new Promise((resolve) => {
            finish = resolve;
          });
    const api = { ...fakeApi(), get: vi.fn(get) } as never;
    renderPage(<AuditRoute />, { api, me: makeMe('owner', ALL) });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Loading more')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    await act(async () => {
      finish({ entries: [entry('1', 'tenant.created')], nextBefore: null });
      await Promise.resolve();
    });
    expect(await screen.findByText('tenant.created')).toBeInTheDocument();
  });
});

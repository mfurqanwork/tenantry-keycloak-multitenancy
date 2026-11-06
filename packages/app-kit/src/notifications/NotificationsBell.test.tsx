import { act, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '../api.js';
import { fakeApi, makeMe, renderWithApp } from '../testing/index.js';
import { linkHref, NotificationsBell, timeAgo } from './NotificationsBell.js';

const WS = [
  {
    slug: 'acme',
    name: 'Acme',
    current: true,
    webUrl: 'http://acme.tenantry.localhost/',
    portalUrl: 'http://acme.portal.tenantry.localhost/',
  },
];
const now = new Date('2026-11-08T12:00:00Z');
const feed = (unread: number) => ({
  unread,
  items: [
    {
      id: 'n1',
      kind: 'team',
      title: 'Ben Acme joined Acme',
      body: 'As Member.',
      link: { app: 'admin', path: '/people' },
      createdAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      unread: unread > 0,
    },
  ],
});

afterEach(() => {
  vi.useRealTimers();
});

function show(api = fakeApi({ '/api/notifications': feed(2), 'POST /api/notifications/read': undefined })) {
  renderWithApp(<NotificationsBell workspaces={WS} now={() => now} />, { api, me: makeMe('owner', []) });
  return { api, user: userEvent.setup() };
}

describe('NotificationsBell (spec 8.4)', () => {
  it('shows the unread count on the bell', async () => {
    show();
    expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument();
  });

  it('has no count when everything is read', async () => {
    show(fakeApi({ '/api/notifications': feed(0) }));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('lists notifications with their time and link, and marks them all read', async () => {
    const { api, user } = show();
    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    const panel = screen.getByRole('region', { name: 'Notifications' });
    const link = within(panel).getByRole('link', { name: /Ben Acme joined Acme/ });
    expect(link).toHaveAttribute('href', 'http://acme.portal.tenantry.localhost/people');
    expect(within(panel).getByText('5 min ago')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    expect(api.post).toHaveBeenCalledWith('/api/notifications/read', {});
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });
  });

  it('says so when there is nothing yet', async () => {
    const { user } = show(fakeApi({ '/api/notifications': { unread: 0, items: [] } }));
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('shows an error in the panel and keeps working', async () => {
    const { user } = show(
      fakeApi({ '/api/notifications': new ApiProblem(500, 'Server error', 'Something went wrong.') }),
    );
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  });

  it('refreshes every minute while the page is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { api } = show();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe('notification links and times', () => {
  it('builds addresses in this workspace and in another', () => {
    expect(linkHref({ app: 'web', path: '/' }, WS)).toBe('http://acme.tenantry.localhost/');
    expect(linkHref({ app: 'admin', path: '/branding' }, WS)).toBe(
      'http://acme.portal.tenantry.localhost/branding',
    );
    expect(linkHref({ app: 'web', path: '/', workspace: 'globex' }, WS)).toBe(
      'http://globex.tenantry.localhost/',
    );
    expect(linkHref({ app: 'web', path: '/' }, [])).toBeNull();
  });

  it.each([
    [30_000, 'Just now'],
    [5 * 60_000, '5 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [2 * 86_400_000, '2 days ago'],
  ])('%i ms ago reads %s', (ms, text) => {
    expect(timeAgo(new Date(now.getTime() - ms).toISOString(), now)).toBe(text);
  });
});

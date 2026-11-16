import { screen, waitFor, within } from '@testing-library/react';
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

  it('lists notifications with their time and link, and marks them all read', async () => {
    const { api, user } = show();
    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    // A panel, not a menu: its heading, status text and unread marks are read in order with a screen reader.
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    const list = within(panel).getByRole('list');
    const link = within(list).getByRole('link', { name: /Ben Acme joined Acme/ });
    expect(link).toHaveAttribute('href', 'http://acme.portal.tenantry.localhost/people');
    expect(link).toHaveAccessibleName(/Unread/);
    expect(within(panel).getByText('5 min ago')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    expect(api.post).toHaveBeenCalledWith('/api/notifications/read', {});
    // The panel stays open after marking, the unread mark goes, and the bell loses its count.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications', hidden: true })).toBeInTheDocument();
    });
    expect(within(panel).getByRole('link', { name: /Ben Acme joined Acme/ })).not.toHaveAccessibleName(
      /Unread/,
    );
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows an error in the panel and keeps working', async () => {
    const { user } = show(
      fakeApi({ '/api/notifications': new ApiProblem(500, 'Server error', 'Something went wrong.') }),
    );
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
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

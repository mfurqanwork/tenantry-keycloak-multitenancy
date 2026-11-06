import { ROLE_PERMISSIONS } from '@tenantry/auth';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, makeMe, renderWithApp } from '../testing/index.js';
import { WorkspaceSearch } from './WorkspaceSearch.js';

const pages = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'People', href: 'http://acme.portal.test/people', crossApp: true },
];
const api = () =>
  fakeApi({
    '/api/members': {
      members: [{ userId: 'u1', email: 'ada@example.test', displayName: 'Ada Acme' }],
      invites: [],
    },
    '/api/projects': { projects: [{ id: 'p1', name: 'Launch plan', createdAt: '2026-11-01T00:00:00Z' }] },
  });
const realLocation = window.location;

afterEach(() => {
  vi.stubGlobal('location', realLocation);
});

function open(routes = api(), role: 'owner' | 'member' = 'owner', menu = pages) {
  renderWithApp(<WorkspaceSearch pages={menu} />, {
    api: routes,
    me: makeMe(role, [...ROLE_PERMISSIONS[role]]),
  });
  return userEvent.setup();
}

describe('WorkspaceSearch (spec 8.3)', () => {
  it('opens from the header button and with Ctrl+K, and closes with Esc', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('searchbox')).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('searchbox')).toBeNull();
    });
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });

  it('groups what it finds into pages, people and projects', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('searchbox'), 'a');
    const people = await screen.findByRole('group', { name: 'People' });
    expect(within(people).getByText('Ada Acme')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Projects' })).getByText('Launch plan'),
    ).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('searchbox'), 'zzz');
    expect(await screen.findByText('Nothing matches "zzz".')).toBeInTheDocument();
  });

  it('opens the highlighted result with Enter, after the arrow keys move', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { href: realLocation.href, assign });
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('searchbox'), 'peop');
    await screen.findByText('People');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(assign).toHaveBeenCalledWith('http://acme.portal.test/people');
  });

  it("does not read people for someone who can't, and shows a member no Admin pages", async () => {
    const routes = api();
    const user = open(routes, 'member', pages.slice(0, 2));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('searchbox'), 'peo');
    expect(await screen.findByText('Nothing matches "peo".')).toBeInTheDocument();
    expect(routes.get).toHaveBeenCalledWith('/api/projects');
  });
});

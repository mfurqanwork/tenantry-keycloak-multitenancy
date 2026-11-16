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
  it('groups what it finds into pages, people and projects', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(await screen.findByRole('combobox', { name: 'Search pages, people and projects' }), 'a');
    const people = await screen.findByRole('group', { name: 'People' });
    expect(within(people).getByText('Ada Acme')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Projects' })).getByText('Launch plan'),
    ).toBeInTheDocument();
  });

  it("does not read people for someone who can't, and shows a member no Admin pages", async () => {
    const routes = api();
    const user = open(routes, 'member', pages.slice(0, 2));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(
      await screen.findByRole('combobox', { name: 'Search pages, people and projects' }),
      'peo',
    );
    expect(await screen.findByText('Nothing matches "peo".')).toBeInTheDocument();
    expect(routes.get).toHaveBeenCalledWith('/api/projects');
  });

  it('Ctrl+K opens search and Escape returns focus', async () => {
    const user = open();
    const button = screen.getByRole('button', { name: 'Search' });
    button.focus();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    });
    expect(button).toHaveFocus();
  });
});

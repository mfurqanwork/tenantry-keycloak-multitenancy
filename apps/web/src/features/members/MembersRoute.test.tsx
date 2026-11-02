import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiProblem } from '../../lib/api.js';
import { ALL, fakeApi, makeMe, MEMBER, renderPage } from '../../test-utils.js';
import { MembersRoute } from './MembersRoute.js';

const LIST = {
  members: [
    { userId: 'u-me', email: 'me@example.com', displayName: 'Me', role: 'owner' },
    { userId: 'u-bob', email: 'bob@example.com', displayName: 'Bob', role: 'member' },
  ],
  invites: [{ id: 'i-1', email: 'carol@example.com', role: 'admin', createdAt: '2026-11-02T10:00:00Z' }],
};

describe('MembersRoute', () => {
  it('lists members with their roles and the pending invites', async () => {
    renderPage(<MembersRoute />, { api: fakeApi({ '/api/members': LIST }), me: makeMe('owner', ALL) });
    expect(await screen.findByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
  });

  it('hides invite, role and remove controls from a member', async () => {
    renderPage(<MembersRoute />, { api: fakeApi({ '/api/members': LIST }), me: makeMe('member', MEMBER) });
    await screen.findByText('bob@example.com');
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument();
  });

  it('invites someone and refreshes the list', async () => {
    const api = fakeApi({ '/api/members': LIST, 'POST /api/members/invites': { id: 'i-2' } });
    renderPage(<MembersRoute />, { api, me: makeMe('owner', ALL) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Invite member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite member' });
    await user.type(within(dialog).getByLabelText('Email'), 'dave@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/members/invites', {
        email: 'dave@example.com',
        role: 'member',
      });
    });
    await waitFor(() => {
      expect(api.get.mock.calls.filter(([p]) => p === '/api/members')).toHaveLength(2);
    });
  });

  it('shows why an invite was refused, inside the dialog', async () => {
    const conflict = new ApiProblem(409, 'Conflict', 'This person already has an open invite.');
    renderPage(<MembersRoute />, {
      api: fakeApi({ '/api/members': LIST, 'POST /api/members/invites': conflict }),
      me: makeMe('owner', ALL),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Invite member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite member' });
    await user.type(within(dialog).getByLabelText('Email'), 'carol@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(await within(dialog).findByText('This person already has an open invite.')).toBeInTheDocument();
  });

  it('changes a role, and shows the last-owner refusal', async () => {
    const lastOwner = new ApiProblem(409, 'Conflict', 'A workspace needs at least one owner.');
    const api = fakeApi({ '/api/members': LIST, 'PATCH /api/members/u-bob': lastOwner });
    renderPage(<MembersRoute />, { api, me: makeMe('owner', ALL) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for bob@example.com' }));
    // jsdom does no layout, so Carbon's floating menu stays visibility: hidden (no accessible names);
    // pick the item by its text. The browser check covers the real menu.
    await user.click(await screen.findByText('Change role'));
    const dialog = await screen.findByRole('dialog', { name: 'Change role' });
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'admin');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(api.patch).toHaveBeenCalledWith('/api/members/u-bob', { role: 'admin' });
    expect(await within(dialog).findByText('A workspace needs at least one owner.')).toBeInTheDocument();
  });

  it('shows a refused list load inline, not a blank page', async () => {
    const forbidden = new ApiProblem(403, 'Forbidden', 'You do not have permission to do this.');
    renderPage(<MembersRoute />, {
      api: fakeApi({ '/api/members': forbidden }),
      me: makeMe('member', MEMBER),
    });
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
  });
});

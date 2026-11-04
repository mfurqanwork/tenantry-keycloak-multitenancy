import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiProblem } from '@tenantry/app-kit';
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

describe('MembersRoute: console access (enterprise)', () => {
  const ENT = {
    members: [
      { userId: 'u-me', email: 'me@example.com', displayName: 'Me', role: 'owner', console: false },
      { userId: 'u-ann', email: 'ann@example.com', displayName: 'Ann', role: 'admin', console: true },
      { userId: 'u-bob', email: 'bob@example.com', displayName: 'Bob', role: 'member', console: false },
    ],
    invites: [],
  };
  const enterpriseOwner = () => {
    const me = makeMe('owner', [...ALL, 'tenant:settings']);
    return { ...me, tenant: { ...me.tenant, tier: 'enterprise' as const } };
  };
  const menu = async (email: string) => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `Actions for ${email}` }));
    return user;
  };

  it('shows who has console access', async () => {
    renderPage(<MembersRoute />, { api: fakeApi({ '/api/members': ENT }), me: enterpriseOwner() });
    expect(await screen.findByText('Admin · Console access')).toBeInTheDocument();
  });

  it('owners give an admin, or themselves, console access and take it back', async () => {
    const api = fakeApi({
      '/api/members': ENT,
      'POST /api/members/u-me/console': undefined,
      'DELETE /api/members/u-ann/console': undefined,
    });
    renderPage(<MembersRoute />, { api, me: enterpriseOwner() });
    let user = await menu('me@example.com');
    await user.click(await screen.findByText('Give console access'));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/members/u-me/console', {});
    });
    user = await menu('ann@example.com');
    await user.click(await screen.findByText('Take console access away'));
    await waitFor(() => {
      expect(api.del).toHaveBeenCalledWith('/api/members/u-ann/console');
    });
  });

  it("offers nothing for a member's row", async () => {
    renderPage(<MembersRoute />, { api: fakeApi({ '/api/members': ENT }), me: enterpriseOwner() });
    await menu('bob@example.com');
    expect(await screen.findByText('Change role')).toBeInTheDocument();
    expect(screen.queryByText(/console access/)).not.toBeInTheDocument();
  });

  it('offers nothing on a Standard workspace', async () => {
    renderPage(<MembersRoute />, { api: fakeApi({ '/api/members': LIST }), me: makeMe('owner', ALL) });
    await menu('bob@example.com');
    expect(await screen.findByText('Change role')).toBeInTheDocument();
    expect(screen.queryByText(/console access/)).not.toBeInTheDocument();
  });

  it("shows the API's refusal", async () => {
    const refused = new ApiProblem(
      502,
      'Bad Gateway',
      'The identity service is unavailable. Try again shortly.',
    );
    renderPage(<MembersRoute />, {
      api: fakeApi({ '/api/members': ENT, 'DELETE /api/members/u-ann/console': refused }),
      me: enterpriseOwner(),
    });
    const user = await menu('ann@example.com');
    await user.click(await screen.findByText('Take console access away'));
    expect(await screen.findByText(/The identity service is unavailable/)).toBeInTheDocument();
  });
});

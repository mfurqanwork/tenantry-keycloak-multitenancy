import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, OWNER, renderPortal } from '../../test-utils.js';
import { ScimRoute } from './ScimRoute.js';

const me = makeMe('owner', OWNER);
const URL_ = 'http://acme.tenantry.localhost/scim/v2';
const none = { url: URL_, token: null, defaultRole: 'member' };
const active = {
  url: URL_,
  token: { expiresAt: '2027-02-01T00:00:00.000Z', lastUsedAt: null, createdAt: '2026-11-03T00:00:00.000Z' },
  defaultRole: 'member',
};
const SECRET = 'tnt_scim_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

function setup(routes: Record<string, unknown> = {}) {
  const api = fakeApi({ '/api/scim': none, ...routes });
  const view = renderPortal(<ScimRoute />, { api, me, path: '/scim' });
  return { api, view, user: userEvent.setup() };
}

describe('ScimRoute', () => {
  it('shows the SCIM address to copy', async () => {
    setup();
    expect(await screen.findByText(URL_)).toBeInTheDocument();
  });

  it('generates a token with the chosen expiry and shows it once', async () => {
    const { api, user, view } = setup({
      'POST /api/scim/token': { token: SECRET, expiresAt: '2027-11-04T00:00:00.000Z' },
    });
    await user.selectOptions(await screen.findByLabelText('Token expires after'), '365');
    await user.click(screen.getByRole('button', { name: 'Generate token' }));
    expect(api.post).toHaveBeenCalledWith('/api/scim/token', { expiresInDays: 365 });
    expect(await screen.findByText('Copy the SCIM token now')).toBeInTheDocument();
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    view.unmount();
    setup({ '/api/scim': active });
    expect(await screen.findByText('Expires')).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
  });

  it('shows the active token without its value, with replace and revoke', async () => {
    setup({ '/api/scim': active });
    expect(await screen.findByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate token' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace token' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('replaces the token after saying the old one stops at once', async () => {
    const { api, user } = setup({
      '/api/scim': active,
      'POST /api/scim/token': { token: SECRET, expiresAt: '2027-02-02T00:00:00.000Z' },
    });
    await user.click(await screen.findByRole('button', { name: 'Replace token' }));
    expect(screen.getByText(/The current token stops working at once/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Replace token' }).at(-1) as HTMLElement);
    expect(api.post).toHaveBeenCalledWith('/api/scim/token', { expiresInDays: 90 });
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it('revokes the token after a danger confirmation', async () => {
    const { api, user } = setup({ '/api/scim': active, 'DELETE /api/scim/token': undefined });
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(screen.getByText(/directory can no longer change people/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke token' }));
    await waitFor(() => {
      expect(api.del).toHaveBeenCalledWith('/api/scim/token');
    });
  });

  it('saves the default role', async () => {
    const { api, user } = setup({ 'PUT /api/scim/default-role': { ...none, defaultRole: 'none' } });
    const role = await screen.findByLabelText('Role for people the directory creates');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.selectOptions(role, 'none');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.put).toHaveBeenCalledWith('/api/scim/default-role', { role: 'none' });
  });

  it('explains Standard workspaces without asking the API', () => {
    const api = fakeApi();
    renderPortal(<ScimRoute />, {
      api,
      me: { ...me, tenant: { ...me.tenant, tier: 'standard' } },
      path: '/scim',
    });
    expect(
      screen.getByText('Security settings and SCIM are available on Enterprise workspaces.'),
    ).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});

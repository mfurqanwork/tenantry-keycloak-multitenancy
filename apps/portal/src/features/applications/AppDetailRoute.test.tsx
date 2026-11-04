import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ApiProblem } from '@tenantry/app-kit';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, makeMe, renderPortal } from '../../test-utils.js';
import type { AppView } from './api.js';
import { AppDetailRoute } from './AppDetailRoute.js';
import { sampleApp } from './test-data.js';

const startTestLogin = vi.fn();
vi.mock('@tenantry/oidc-client', () => ({
  startTestLogin: (...args: unknown[]): unknown => startTestLogin(...args),
}));

const ADMIN = makeMe('admin', ['apps:read', 'apps:register']);
const MEMBER = makeMe('member', ['apps:read']);

function setup(
  app: AppView,
  o: { me?: typeof ADMIN; state?: unknown; routes?: Record<string, unknown> } = {},
) {
  const api = fakeApi({ [`/api/apps/${app.id}`]: app, ...o.routes });
  renderPortal(
    <Routes>
      <Route path="/applications/:id" element={<AppDetailRoute />} />
      <Route path="/applications" element={<p>Back on the list</p>} />
    </Routes>,
    {
      api,
      me: o.me ?? ADMIN,
      path: `/applications/${app.id}`,
      ...(o.state ? { state: o.state } : {}),
    },
  );
  return { api, user: userEvent.setup() };
}

beforeEach(() => {
  startTestLogin.mockReset();
});

describe('AppDetailRoute', () => {
  it('shows the connection details', async () => {
    const app = sampleApp();
    setup(app);
    expect(await screen.findByRole('heading', { level: 1, name: 'HR portal' })).toBeInTheDocument();
    const details = screen.getByRole('table', { name: 'Connection details' });
    for (const value of [
      app.connection.issuer,
      app.connection.discoveryUrl,
      app.connection.tokenEndpoint,
      app.connection.jwksUri,
      app.connection.endSessionEndpoint,
      'openid profile email',
    ]) {
      expect(within(details).getAllByText(value).length).toBeGreaterThan(0);
    }
    expect(within(details).getByText('Shown once, when registered or rotated')).toBeInTheDocument();
  });

  it('shows the portal test sign-in address it added, and none for machine to machine', async () => {
    const app = sampleApp();
    setup(app);
    const details = await screen.findByRole('table', { name: 'Connection details' });
    expect(within(details).getByText('Tenantry test sign-in (kept by Tenantry)')).toBeInTheDocument();
    expect(within(details).getByText(app.connection.testRedirectUri ?? '-')).toBeInTheDocument();
  });

  it('lists no test sign-in address for a machine-to-machine app', async () => {
    setup(sampleApp({ type: 'm2m', redirectUris: [] }));
    const details = await screen.findByRole('table', { name: 'Connection details' });
    expect(within(details).queryByText('Tenantry test sign-in (kept by Tenantry)')).not.toBeInTheDocument();
  });

  it('keeps its header and the way back when the app cannot be loaded', async () => {
    const api = fakeApi({ '/api/apps/a9': new ApiProblem(404, 'Not Found', 'No app with this id.') });
    renderPortal(
      <Routes>
        <Route path="/applications/:id" element={<AppDetailRoute />} />
      </Routes>,
      { api, me: ADMIN, path: '/applications/a9' },
    );
    expect(await screen.findByText('No app with this id.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Application' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Applications' })).toHaveAttribute('href', '/applications');
  });

  it('names each value it offers to copy', async () => {
    const app = sampleApp();
    setup(app);
    expect(await screen.findByLabelText('Issuer')).toBeInTheDocument();
    expect(screen.getByLabelText('Token endpoint')).toBeInTheDocument();
  });

  it('clears the last token check and says it is asking while a new one runs', async () => {
    const m2m = sampleApp({ type: 'm2m', redirectUris: [] });
    const { api, user } = setup(m2m, {
      routes: { 'POST /api/apps/a1/token-check': { ok: false, error: 'Invalid client credentials' } },
    });
    await user.click(await screen.findByRole('tab', { name: 'Request a token' }));
    await user.type(screen.getByLabelText('Client secret'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Request a token' }));
    expect(await screen.findByText('Invalid client credentials')).toBeInTheDocument();
    api.post.mockReturnValueOnce(new Promise(() => undefined));
    await user.click(screen.getByRole('button', { name: 'Request a token' }));
    expect(screen.queryByText('Invalid client credentials')).not.toBeInTheDocument();
    expect(screen.getByText('Asking Keycloak for a token')).toBeInTheDocument();
  });

  it('shows the secret it was handed once', async () => {
    setup(sampleApp(), { state: { clientSecret: 's3cret' } });
    expect(await screen.findByText('Copy the client secret now')).toBeInTheDocument();
    expect(screen.getAllByText('s3cret').length).toBeGreaterThan(0);
  });

  it('has no secret to show without one', async () => {
    setup(sampleApp());
    await screen.findByRole('heading', { level: 1, name: 'HR portal' });
    expect(screen.queryByText('Copy the client secret now')).not.toBeInTheDocument();
  });

  it('says a public client has no secret, and offers no rotation', async () => {
    setup(sampleApp({ type: 'spa' }));
    expect(await screen.findByText('None (public client, PKCE)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rotate secret' })).not.toBeInTheDocument();
  });

  it('rotates the secret after asking, and shows the new one once', async () => {
    const { api, user } = setup(sampleApp(), {
      routes: { 'POST /api/apps/a1/secret': { clientSecret: 'n3w' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Rotate secret' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rotate secret' }));
    expect(api.post).toHaveBeenCalledWith('/api/apps/a1/secret', {});
    expect(await screen.findByText('Copy the client secret now')).toBeInTheDocument();
    expect(screen.getAllByText('n3w').length).toBeGreaterThan(0);
  });

  it('deletes only once the name is typed, then goes back to the list', async () => {
    const { api, user } = setup(sampleApp(), { routes: { 'DELETE /api/apps/a1': undefined } });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete app' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type HR portal to confirm'), 'HR portal');
    await user.click(confirm);
    expect(api.del).toHaveBeenCalledWith('/api/apps/a1');
    expect(await screen.findByText('Back on the list')).toBeInTheDocument();
  });

  it('edits the name and URIs, sending the whole form', async () => {
    const { api, user } = setup(sampleApp(), {
      routes: { 'PATCH /api/apps/a1': sampleApp({ name: 'HR' }) },
    });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'HR');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(api.patch).toHaveBeenCalledWith('/api/apps/a1', {
      name: 'HR',
      redirectUris: ['https://hr.acme.test/callback'],
      postLogoutRedirectUris: [],
      webOrigins: [],
    });
  });

  it('starts a test sign-in: a web app stops at the code', async () => {
    const web = sampleApp();
    const { user } = setup(web);
    await user.click(await screen.findByRole('tab', { name: 'Test' }));
    await user.click(screen.getByRole('button', { name: 'Test sign-in' }));
    expect(startTestLogin).toHaveBeenCalledWith({
      appId: 'a1',
      clientId: web.clientId,
      authorizationEndpoint: web.connection.authorizationEndpoint,
      tokenEndpoint: web.connection.tokenEndpoint,
      redirectUri: web.connection.testRedirectUri,
      exchange: false,
    });
  });

  it('a single-page app trades the code for tokens', async () => {
    const { user } = setup(sampleApp({ type: 'spa' }));
    await user.click(await screen.findByRole('tab', { name: 'Test' }));
    await user.click(screen.getByRole('button', { name: 'Test sign-in' }));
    expect(startTestLogin).toHaveBeenCalledWith(expect.objectContaining({ exchange: true }));
  });

  it('checks a machine-to-machine token with the pasted secret', async () => {
    const m2m = sampleApp({ type: 'm2m', redirectUris: [] });
    const { api, user } = setup(m2m, {
      routes: { 'POST /api/apps/a1/token-check': { ok: false, error: 'Invalid client credentials' } },
    });
    await user.click(await screen.findByRole('tab', { name: 'Request a token' }));
    await user.type(screen.getByLabelText('Client secret'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Request a token' }));
    expect(api.post).toHaveBeenCalledWith('/api/apps/a1/token-check', { clientSecret: 'wrong' });
    expect(await screen.findByText('Invalid client credentials')).toBeInTheDocument();
    api.post.mockResolvedValueOnce({ ok: true });
    await user.click(screen.getByRole('button', { name: 'Request a token' }));
    await waitFor(() => {
      expect(screen.getByText('Keycloak issued a token for this app.')).toBeInTheDocument();
    });
  });

  it('shows members the details without any action', async () => {
    setup(sampleApp(), { me: MEMBER });
    await screen.findByRole('heading', { level: 1, name: 'HR portal' });
    for (const name of ['Edit', 'Rotate secret', 'Delete', 'Test sign-in']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

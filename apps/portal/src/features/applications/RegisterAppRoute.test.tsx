import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ApiProblem } from '@tenantry/app-kit';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, renderPortal } from '../../test-utils.js';
import { RegisterAppRoute } from './RegisterAppRoute.js';
import { sampleApp } from './test-data.js';

const me = makeMe('admin', ['apps:read', 'apps:register']);

function Landed() {
  const { pathname, state } = useLocation() as { pathname: string; state: { clientSecret?: string } | null };
  return (
    <p>
      Landed on {pathname} with {state?.clientSecret ?? 'no secret'}
    </p>
  );
}

function setup(routes: Record<string, unknown> = {}) {
  const api = fakeApi(routes);
  renderPortal(
    <Routes>
      <Route path="/applications/new" element={<RegisterAppRoute />} />
      <Route path="/advanced/apps/:id" element={<Landed />} />
    </Routes>,
    { api, me, path: '/applications/new' },
  );
  return { api, user: userEvent.setup() };
}

const next = () => screen.getByRole('button', { name: 'Next' });

// Fills a field in one change, as a paste does: typing long URIs key by key is slow on CI.
async function fill(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.click(screen.getByLabelText(label));
  await user.paste(text);
}

describe('RegisterAppRoute', () => {
  it('walks type, details and review, then opens the new app with its secret', async () => {
    const { api, user } = setup({ 'POST /api/apps': { app: sampleApp(), clientSecret: 's3cret' } });
    await user.click(screen.getByLabelText('Web app'));
    await user.click(next());
    await fill(user, 'Name', 'HR portal');
    await fill(user, 'Redirect URI 1', 'https://hr.acme.test/callback');
    await user.click(next());
    expect(screen.getByRole('table', { name: 'Review' })).toHaveTextContent('https://hr.acme.test/callback');
    await user.click(screen.getByRole('button', { name: 'Register app' }));
    expect(api.post).toHaveBeenCalledWith('/api/apps', {
      name: 'HR portal',
      type: 'web',
      redirectUris: ['https://hr.acme.test/callback'],
      postLogoutRedirectUris: [],
      webOrigins: [],
    });
    expect(await screen.findByText('Landed on /advanced/apps/a1 with s3cret')).toBeInTheDocument();
  });

  it('says what is wrong with a URI as it is typed, and holds the step until it is fixed', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Single-page app'));
    await user.click(next());
    await fill(user, 'Name', 'Dash');
    await fill(user, 'Redirect URI 1', 'http://localhost:3000/cb');
    expect(screen.getByText('Use 127.0.0.1 instead of localhost.')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await user.clear(screen.getByLabelText('Redirect URI 1'));
    await fill(user, 'Redirect URI 1', 'http://127.0.0.1:3000/cb');
    expect(next()).toBeEnabled();
  });

  it('adds and removes URI rows', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Web app'));
    await user.click(next());
    await user.click(screen.getByRole('button', { name: 'Add redirect URI' }));
    expect(screen.getByLabelText('Redirect URI 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove redirect URI 2' }));
    expect(screen.queryByLabelText('Redirect URI 2')).not.toBeInTheDocument();
  });

  it('asks a machine-to-machine app for its name only', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Machine to machine'));
    await user.click(next());
    expect(screen.queryByLabelText('Redirect URI 1')).not.toBeInTheDocument();
    await fill(user, 'Name', 'Sync');
    expect(next()).toBeEnabled();
  });

  it("puts the API's field errors on their fields, and shows any other refusal above", async () => {
    const { api, user } = setup({
      'POST /api/apps': new ApiProblem(
        422,
        'Invalid request',
        'redirectUris.0: Invalid Redirect Uri: invalid uri',
      ),
    });
    await user.click(screen.getByLabelText('Web app'));
    await user.click(next());
    await fill(user, 'Name', 'HR');
    await fill(user, 'Redirect URI 1', 'https://hr.acme.test/cb');
    await user.click(next());
    await user.click(screen.getByRole('button', { name: 'Register app' }));
    expect(await screen.findByText('Invalid Redirect Uri: invalid uri')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await user.clear(screen.getByLabelText('Redirect URI 1'));
    await fill(user, 'Redirect URI 1', 'https://hr2.acme.test/cb');
    api.post.mockRejectedValueOnce(
      new ApiProblem(409, 'Conflict', 'This workspace has the most apps allowed (20).'),
    );
    await user.click(next());
    await user.click(screen.getByRole('button', { name: 'Register app' }));
    await waitFor(() => {
      expect(screen.getByText('This workspace has the most apps allowed (20).')).toBeInTheDocument();
    });
  });
});

import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SECURITY_DEFAULTS } from '@tenantry/auth';
import { describe, expect, it } from 'vitest';
import { fakeApi, makeMe, OWNER, renderPortal } from '../../test-utils.js';
import { SecurityRoute } from './SecurityRoute.js';

const me = makeMe('owner', OWNER);

function setup(routes: Record<string, unknown> = {}) {
  const api = fakeApi({ '/api/security': SECURITY_DEFAULTS, ...routes });
  renderPortal(<SecurityRoute />, { api, me, path: '/security' });
  return { api, user: userEvent.setup() };
}

const field = (name: string) => screen.findByRole('spinbutton', { name });
const save = () => screen.getByRole('button', { name: 'Save' });

describe('SecurityRoute', () => {
  it('loads the saved settings, grouped, with Save off', async () => {
    setup();
    expect(await field('Minimum length')).toHaveValue(12);
    for (const legend of ['Two-step sign-in', 'Passwords', 'Sessions', 'Lockout']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: /Optional/ })).toBeChecked();
    expect(screen.getByText('From 12 to 64 characters.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('saves the whole object and says so', async () => {
    const changed = { ...SECURITY_DEFAULTS, twoStep: 'required', passwordMinLength: 16 };
    const { api, user } = setup({ 'PUT /api/security': changed });
    const length = await field('Minimum length');
    await user.clear(length);
    await user.type(length, '16');
    await user.click(screen.getByRole('radio', { name: /Required/ }));
    await user.click(save());
    expect(api.put).toHaveBeenCalledWith('/api/security', changed);
    expect(await screen.findByText('Security settings saved.')).toBeInTheDocument();
  });

  it('shows the shared message inline and keeps Save off while a value is wrong', async () => {
    const { user } = setup();
    const idle = await field('Idle timeout (minutes)');
    await user.clear(idle);
    await user.type(idle, '720');
    const max = await field('Longest session (hours)');
    await user.clear(max);
    await user.type(max, '1');
    expect(await screen.findByText('A session cannot sit idle longer than it may last.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});

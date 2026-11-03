import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ApiProblem } from '@tenantry/app-kit';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, makeMe, OWNER, renderPortal } from '../../test-utils.js';
import { BrandingRoute } from './BrandingRoute.js';

const saved = { name: 'Acme', primaryColor: '#0f62fe', logoUrl: null };
const me = makeMe('owner', OWNER);

function setup(routes: Record<string, unknown> = {}) {
  const api = fakeApi({ '/api/tenants/acme/branding': saved, ...routes });
  const onChanged = vi.fn();
  renderPortal(<BrandingRoute onChanged={onChanged} />, { api, me, path: '/branding' });
  return { api, onChanged, user: userEvent.setup() };
}

const colour = () => screen.findByLabelText('Primary colour');

describe('BrandingRoute', () => {
  it('starts from the saved colour, with Save off until something changes', async () => {
    setup();
    expect(await colour()).toHaveValue('#0f62fe');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a new colour', async () => {
    const { api, onChanged, user } = setup({ 'PUT /api/branding': { primaryColor: '#198038' } });
    await user.clear(await colour());
    await user.type(await colour(), '#198038');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.put).toHaveBeenCalledWith('/api/branding', { primaryColor: '#198038' });
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('refuses a malformed colour before saving', async () => {
    const { api, user } = setup();
    await user.clear(await colour());
    await user.type(await colour(), 'blue');
    expect(screen.getByText('Use a colour like #0f62fe.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("offers the API's darker shade when a colour is too light", async () => {
    const tooLight = new ApiProblem(422, 'Invalid request', 'This colour is too light for white text.', {
      suggestion: '#8a6d00',
    });
    const { user } = setup({ 'PUT /api/branding': tooLight });
    await user.clear(await colour());
    await user.type(await colour(), '#ffcc00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Suggested: #8a6d00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this colour' }));
    expect(await colour()).toHaveValue('#8a6d00');
  });

  it('uploads a logo', async () => {
    const { api, onChanged, user } = setup({ 'UPLOAD /api/branding/logo': {} });
    const file = new File([new Uint8Array([0x89, 0x50])], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/Drag and drop a logo/), file);
    expect(api.upload).toHaveBeenCalledWith('/api/branding/logo', 'file', file);
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('refuses a logo over 256 KB before uploading it', async () => {
    const { api, user } = setup();
    const big = new File([new Uint8Array(262145)], 'big.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/Drag and drop a logo/), big);
    expect(await screen.findByText('The logo must be 256 KB or smaller.')).toBeInTheDocument();
    expect(api.upload).not.toHaveBeenCalled();
  });
});

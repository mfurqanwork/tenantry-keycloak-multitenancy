import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type Api, ApiProblem, ApiProvider } from '@tenantry/app-kit';
import { SignupRoute } from './SignupRoute.js';

function fakeApi(overrides: Partial<Api> = {}): Api {
  return {
    get: vi.fn().mockResolvedValue({ available: true }),
    post: vi.fn().mockResolvedValue({ slug: 'acme', url: 'http://acme.tenantry.localhost' }),
    patch: vi.fn(),
    del: vi.fn(),
    ...overrides,
  };
}

function renderSignup(api: Api, onCreated = vi.fn()) {
  render(
    <ApiProvider api={api}>
      <SignupRoute baseDomain="tenantry.localhost" onCreated={onCreated} />
    </ApiProvider>,
  );
  return onCreated;
}

async function fillDetails(name: string, slug?: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Workspace name'), name);
  if (slug !== undefined) {
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), slug);
  }
  await user.click(screen.getByRole('button', { name: 'Next' }));
  return user;
}

describe('SignupRoute', () => {
  it('suggests an address from the name', async () => {
    renderSignup(fakeApi());
    await userEvent.setup().type(screen.getByLabelText('Workspace name'), 'Acme Inc');
    expect(screen.getByLabelText('Address')).toHaveValue('acme-inc');
  });

  it('says when the address is taken', async () => {
    renderSignup(fakeApi({ get: vi.fn().mockResolvedValue({ available: false, reason: 'taken' }) }));
    await fillDetails('Acme');
    expect(await screen.findByText('This address is taken.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create workspace' })).not.toBeInTheDocument();
  });

  it('says when the address is reserved', async () => {
    renderSignup(fakeApi({ get: vi.fn().mockResolvedValue({ available: false, reason: 'reserved' }) }));
    await fillDetails('Admin');
    expect(await screen.findByText('This address is reserved.')).toBeInTheDocument();
  });

  it('creates the workspace and goes to its address', async () => {
    const api = fakeApi();
    const onCreated = renderSignup(api);
    const user = await fillDetails('Acme', 'acme');
    expect(await screen.findByText('acme.tenantry.localhost')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('http://acme.tenantry.localhost');
    });
    expect(api.post).toHaveBeenCalledWith('/api/signup', { name: 'Acme', slug: 'acme' });
  });

  it('keeps the form and shows the error when creation fails', async () => {
    const failure = new ApiProblem(502, 'Bad Gateway', 'We could not finish setting up your workspace.');
    const onCreated = renderSignup(fakeApi({ post: vi.fn().mockRejectedValue(failure) }));
    const user = await fillDetails('Acme', 'acme');
    await user.click(await screen.findByRole('button', { name: 'Create workspace' }));
    expect(await screen.findByText('We could not finish setting up your workspace.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('needs a name before going on', () => {
    renderSignup(fakeApi());
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

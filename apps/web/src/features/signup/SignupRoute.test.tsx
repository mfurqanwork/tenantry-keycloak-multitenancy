import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type Api, ApiProblem, ApiProvider } from '@tenantry/app-kit';
import { SignupRoute } from './SignupRoute.js';

function fakeApi(overrides: Partial<Api> = {}): Api {
  return {
    get: vi.fn().mockResolvedValue({ available: true }),
    post: vi.fn().mockResolvedValue({ slug: 'acme', url: 'http://acme.tenantry.localhost' }),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
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
  await user.click(screen.getByRole('button', { name: 'Create workspace' }));
  return user;
}

describe('SignupRoute (one screen)', () => {
  it('asks for a name and an address on one screen, with no steps', () => {
    renderSignup(fakeApi());
    expect(screen.getByRole('heading', { level: 1, name: 'Create a workspace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace name')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(document.querySelector('.cds--progress')).toBeNull();
  });

  it('fills in the address from the name until it is edited', async () => {
    renderSignup(fakeApi());
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc');
    expect(screen.getByLabelText('Address')).toHaveValue('acme-inc');
    expect(screen.getByText('acme-inc.tenantry.localhost')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), 'acme');
    await user.type(screen.getByLabelText('Workspace name'), ' Ltd');
    expect(screen.getByLabelText('Address')).toHaveValue('acme');
  });

  it('says on the address when it is taken, and creates nothing', async () => {
    const api = fakeApi({ get: vi.fn().mockResolvedValue({ available: false, reason: 'taken' }) });
    renderSignup(api);
    await fillDetails('Acme');
    expect(await screen.findByText('This address is taken.')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toHaveAttribute('aria-invalid', 'true');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('says when the address is reserved', async () => {
    renderSignup(fakeApi({ get: vi.fn().mockResolvedValue({ available: false, reason: 'reserved' }) }));
    await fillDetails('Admin');
    expect(await screen.findByText('This address is reserved.')).toBeInTheDocument();
  });

  it('checks the address, creates the workspace and goes to it, in one press', async () => {
    const api = fakeApi();
    const onCreated = renderSignup(api);
    await fillDetails('Acme', 'acme');
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('http://acme.tenantry.localhost');
    });
    expect(api.get).toHaveBeenCalledWith('/api/signup/slug-availability?slug=acme');
    expect(api.post).toHaveBeenCalledWith('/api/signup', { name: 'Acme', slug: 'acme' });
  });

  it('keeps the form and shows the error when creation fails', async () => {
    const failure = new ApiProblem(502, 'Bad Gateway', 'We could not finish setting up your workspace.');
    const onCreated = renderSignup(fakeApi({ post: vi.fn().mockRejectedValue(failure) }));
    await fillDetails('Acme', 'acme');
    expect(await screen.findByText('We could not finish setting up your workspace.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('needs a name before creating', () => {
    renderSignup(fakeApi());
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled();
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KcPage from './KcPage.js';
import { getKcContextMock } from './mock.js';

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

const page = () => <KcPage kcContext={getKcContextMock({ pageId: 'login-username.ftl' })} />;

describe('the login page brand', () => {
  it("shows the workspace's logo, name and colour", async () => {
    window.history.replaceState(
      null,
      '',
      `/?redirect_uri=${encodeURIComponent('http://acme.tenantry.localhost:8080/auth/callback')}`,
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ name: 'Acme', primaryColor: '#198038', logoUrl: '/api/tenants/acme/logo?v=1' }),
          ),
        ),
    );
    const { container } = render(page());
    expect(await screen.findByRole('img', { name: 'Acme' })).toHaveAttribute(
      'src',
      'http://acme.tenantry.localhost:8080/api/tenants/acme/logo?v=1',
    );
    expect(screen.getByText('Acme', { selector: '.tenantry-login__brand-name' })).toBeInTheDocument();
    const branded = container.querySelector<HTMLElement>('.tenantry-login__main');
    expect(branded?.style.getPropertyValue('--cds-button-primary')).toBe('#198038');
  });

  it('shows Tenantry without a workspace', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(page());
    expect(
      await screen.findByText('Tenantry', { selector: '.tenantry-login__brand-name' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

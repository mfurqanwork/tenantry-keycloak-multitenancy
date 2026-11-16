import { render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Acme', { selector: '[data-slot="workspace-name"]' })).toBeInTheDocument();
    // The colour is applied in an effect after the render that shows the logo; slow runners see the gap.
    await waitFor(() => {
      const branded = container.querySelector<HTMLElement>('[data-tenantry-theme]');
      expect(branded?.style.getPropertyValue('--primary')).toBe('#198038');
    });
  });

  it('shows the Tenantry logo without a workspace', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(page());
    const logo = (await screen.findByRole('img', { name: 'Tenantry' })).querySelector('img') ?? document.body;
    // Vite inlines the small SVG (base64 here) or links the file; either way it is the Tenantry logo.
    const src = logo.getAttribute('src') ?? '';
    const svg = src.startsWith('data:image/svg+xml;base64,') ? atob(src.split(',')[1] ?? '') : src;
    expect(svg).toMatch(/tenantry-logo|<title[^>]*>Tenantry<\/title>/);
    // The logo carries the word; it is not written twice.
    expect(screen.queryByText('Tenantry', { selector: '[data-slot="workspace-name"]' })).toBeNull();
  });

  it("never shows Tenantry's logo on a workspace's sign-in, while its brand loads or when it fails", async () => {
    window.history.replaceState(
      null,
      '',
      `/?redirect_uri=${encodeURIComponent('http://acme.tenantry.localhost:8080/auth/callback')}`,
    );
    let fail: (reason: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((_, reject) => (fail = reject))));
    render(page());
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('img', { name: 'Tenantry' })).toBeNull();
    fail(new Error('offline'));
    expect(await screen.findByText('acme', { selector: '[data-slot="workspace-name"]' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Tenantry' })).toBeNull();
  });
});

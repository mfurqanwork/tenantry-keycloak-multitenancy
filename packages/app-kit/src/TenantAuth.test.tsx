import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantAuth } from './TenantAuth.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Answers the API's auth-config; Keycloak itself (discovery, the redirect) never answers in these tests.
function stubAuthConfig(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.includes('/auth-config')
        ? Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status }))
        : new Promise<Response>(() => undefined),
    ),
  );
}

describe('TenantAuth', () => {
  it('shows the not-found page for a workspace that does not exist', async () => {
    stubAuthConfig(404);
    render(
      <TenantAuth slug="ghost" notFound={<p>No workspace here</p>}>
        {() => <p>signed in</p>}
      </TenantAuth>,
    );
    expect(await screen.findByText('No workspace here')).toBeInTheDocument();
  });

  it('starts signing in once the workspace is known', async () => {
    stubAuthConfig(200, {
      issuer: 'http://auth.example/realms/platform',
      clientId: 'tenantry-web',
      organization: 'acme',
    });
    render(
      <TenantAuth slug="acme" notFound={<p>No workspace here</p>}>
        {() => <p>signed in</p>}
      </TenantAuth>,
    );
    expect(await screen.findByText('Signing in')).toBeInTheDocument();
  });
});

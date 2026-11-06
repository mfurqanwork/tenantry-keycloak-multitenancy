import { describe, expect, it } from 'vitest';
import { createAuthClient } from './auth-client.js';

const base = { issuer: 'http://auth.tenantry.localhost/realms/platform', clientId: 'tenantry-web' };

describe('createAuthClient', () => {
  it("asks for the tenant's organization scope", () => {
    const client = createAuthClient({
      ...base,
      organization: 'acme',
      redirectUri: 'http://acme.x/auth/callback',
    });
    expect(client.settings).toMatchObject({
      authority: base.issuer,
      client_id: 'tenantry-web',
      redirect_uri: 'http://acme.x/auth/callback',
      response_type: 'code',
      scope: 'openid organization:acme',
    });
  });

  it('asks for plain openid without an organization (signup)', () => {
    const client = createAuthClient({ ...base, organization: null, redirectUri: 'http://x/auth/callback' });
    expect(client.settings.scope).toBe('openid');
  });

  it('has no token before sign-in', async () => {
    const client = createAuthClient({ ...base, organization: null, redirectUri: 'http://x/auth/callback' });
    await expect(client.getAccessToken()).resolves.toBeNull();
    await expect(client.user()).resolves.toBeNull();
  });

  it('opens registration first for "Create a workspace" (prompt=create)', () => {
    const client = createAuthClient({
      ...base,
      organization: null,
      redirectUri: 'http://x/auth/callback',
      prompt: 'create',
    });
    expect(client.settings.prompt).toBe('create');
    expect(
      createAuthClient({ ...base, organization: null, redirectUri: 'http://x/auth/callback' }).settings
        .prompt,
    ).toBeUndefined();
  });
});

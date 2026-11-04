import { describe, expect, it, vi } from 'vitest';
import { listAppsCommand, registerAppCommand, rotateAppCommand } from './apps.js';
import type { EnterpriseDeps } from './enterprise.js';

function deps(reply: { status: number; body: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const api = vi.fn().mockResolvedValue(reply);
  const d: EnterpriseDeps = {
    api,
    operatorToken: () => Promise.resolve('op-token'),
    baseDomain: 'tenantry.localhost',
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  };
  return { d, out, err, api };
}

const app = { id: 'a1', clientId: 'app-0a1b2c3d', name: 'Initech HR', type: 'web' };

describe('ops apps', () => {
  it('lists the apps of a tenant', async () => {
    const { d, out, api } = deps({ status: 200, body: { apps: [app] } });
    expect(await listAppsCommand(d, { tenant: 'initech' })).toBe(0);
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'GET',
      '/api/platform/enterprise-tenants/initech/apps',
      {
        token: 'op-token',
      },
    );
    expect(out).toEqual(['a1  app-0a1b2c3d  web  Initech HR']);
  });

  it('says when a tenant has no apps', async () => {
    const { d, out } = deps({ status: 200, body: { apps: [] } });
    expect(await listAppsCommand(d, { tenant: 'initech' })).toBe(0);
    expect(out).toEqual(['initech has no apps.']);
  });

  it('registers an app and prints its secret once', async () => {
    const { d, out, api } = deps({ status: 201, body: { app, clientSecret: 's3cret' } });
    expect(
      await registerAppCommand(d, {
        tenant: 'initech',
        name: 'Initech HR',
        type: 'web',
        redirectUris: ['http://127.0.0.1:4000/callback'],
        postLogoutRedirectUris: [],
      }),
    ).toBe(0);
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'POST',
      '/api/platform/enterprise-tenants/initech/apps',
      {
        token: 'op-token',
        body: {
          name: 'Initech HR',
          type: 'web',
          redirectUris: ['http://127.0.0.1:4000/callback'],
          postLogoutRedirectUris: [],
        },
      },
    );
    expect(out).toEqual([
      'Registered Initech HR as app-0a1b2c3d on initech.',
      'Client secret (shown once): s3cret',
    ]);
  });

  it("passes on the API's reason when it refuses", async () => {
    const { d, err } = deps({ status: 422, body: { detail: 'redirectUris.0: Use https.' } });
    expect(
      await registerAppCommand(d, {
        tenant: 'initech',
        name: 'x',
        type: 'web',
        redirectUris: ['http://x.test/cb'],
        postLogoutRedirectUris: [],
      }),
    ).toBe(1);
    expect(err).toEqual(['redirectUris.0: Use https.']);
  });

  it('rotates a secret', async () => {
    const { d, out, api } = deps({ status: 200, body: { clientSecret: 'n3w' } });
    expect(await rotateAppCommand(d, { tenant: 'initech', app: 'a1' })).toBe(0);
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'POST',
      '/api/platform/enterprise-tenants/initech/apps/a1/secret',
      { token: 'op-token' },
    );
    expect(out).toEqual(['New client secret for a1 (shown once): n3w']);
  });
});

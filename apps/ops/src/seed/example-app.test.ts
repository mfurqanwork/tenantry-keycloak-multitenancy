import { describe, expect, it, vi } from 'vitest';
import { ensureExampleApp, type ExampleAppDeps } from './example-app.js';

const app = {
  id: 'a1',
  clientId: 'app-0a1b2c3d',
  name: 'Initech HR',
  connection: { issuer: 'http://auth.tenantry.localhost/realms/ent-initech' },
};

function deps(o: { apps: unknown[]; file: string | null; register?: unknown; rotate?: unknown }) {
  const written: string[] = [];
  const api = vi.fn((_host: string, method: string, path: string) => {
    if (method === 'GET') return Promise.resolve({ status: 200, body: { apps: o.apps } });
    if (path.endsWith('/secret')) return Promise.resolve({ status: 200, body: o.rotate });
    return Promise.resolve({ status: 201, body: o.register });
  });
  const d: ExampleAppDeps = {
    api: api as unknown as ExampleAppDeps['api'],
    operatorToken: () => Promise.resolve('op'),
    baseDomain: 'tenantry.localhost',
    authInternalUrl: 'http://127.0.0.1:8180',
    envFile: { read: () => o.file, write: (text) => written.push(text) },
  };
  return { d, api, written };
}

describe("the seed's example app", () => {
  it('registers Initech HR and writes the example app its settings', async () => {
    const { d, api, written } = deps({ apps: [], file: null, register: { app, clientSecret: 's3cret' } });
    const change = await ensureExampleApp(d);
    expect(change).toBe('example app Initech HR');
    expect(change).not.toContain('s3cret');
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'POST',
      '/api/platform/enterprise-tenants/initech/apps',
      expect.objectContaining({
        body: {
          name: 'Initech HR',
          type: 'web',
          redirectUris: ['http://127.0.0.1:4000/callback'],
          postLogoutRedirectUris: ['http://127.0.0.1:4000/'],
        },
      }),
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toContain('ISSUER=http://auth.tenantry.localhost/realms/ent-initech\n');
    expect(written[0]).toContain('CLIENT_ID=app-0a1b2c3d\n');
    expect(written[0]).toContain('CLIENT_SECRET=s3cret\n');
    expect(written[0]).toContain('AUTH_INTERNAL_URL=http://127.0.0.1:8180\n');
  });

  it('changes nothing when the app and its settings are there', async () => {
    const { d, api, written } = deps({
      apps: [app],
      file: 'ISSUER=x\nCLIENT_ID=app-0a1b2c3d\nCLIENT_SECRET=y\n',
    });
    expect(await ensureExampleApp(d)).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
    expect(written).toEqual([]);
  });

  it('rotates the secret when the settings file is missing, since the old secret cannot be read back', async () => {
    const { d, api, written } = deps({ apps: [app], file: null, rotate: { clientSecret: 'n3w' } });
    expect(await ensureExampleApp(d)).toBe('example app secret');
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'POST',
      '/api/platform/enterprise-tenants/initech/apps/a1/secret',
      expect.anything(),
    );
    expect(written[0]).toContain('CLIENT_SECRET=n3w\n');
  });
});

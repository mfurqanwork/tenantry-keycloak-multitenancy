import { describe, expect, it, vi } from 'vitest';
import { fetchAuthConfig } from './auth-config.js';

const respond = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('fetchAuthConfig', () => {
  it("returns the tenant's sign-in settings", async () => {
    const config = { issuer: 'http://auth/realms/platform', clientId: 'tenantry-web', organization: 'acme' };
    const fetchFn = respond(200, config);
    await expect(fetchAuthConfig('acme', fetchFn)).resolves.toEqual(config);
    expect(fetchFn).toHaveBeenCalledWith('/api/tenants/acme/auth-config', expect.anything());
  });

  it('returns null for an unknown workspace', async () => {
    await expect(fetchAuthConfig('nobody', respond(404))).resolves.toBeNull();
  });

  it('throws on any other failure', async () => {
    await expect(fetchAuthConfig('acme', respond(500))).rejects.toThrow(/500/);
  });
});

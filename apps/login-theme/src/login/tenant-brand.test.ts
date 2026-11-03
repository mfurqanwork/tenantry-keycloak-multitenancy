import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTenantBrand, tenantFromLocation } from './tenant-brand.js';

const redirect = (uri: string) => `?client_id=tenantry-portal&redirect_uri=${encodeURIComponent(uri)}`;

beforeEach(() => {
  sessionStorage.clear();
});

describe('tenantFromLocation', () => {
  it("reads the tenant from the app's redirect address and keeps it for the tab", () => {
    expect(
      tenantFromLocation(
        redirect('http://acme.portal.tenantry.localhost:8080/auth/callback'),
        sessionStorage,
      ),
    ).toEqual({
      origin: 'http://acme.portal.tenantry.localhost:8080',
      slug: 'acme',
    });
    expect(tenantFromLocation('', sessionStorage)).toEqual({
      origin: 'http://acme.portal.tenantry.localhost:8080',
      slug: 'acme',
    });
  });

  it('has no tenant on a first page without one', () => {
    expect(tenantFromLocation('', sessionStorage)).toBeNull();
  });

  it('ignores a redirect address that is not a URL', () => {
    expect(tenantFromLocation('?redirect_uri=not-a-url', sessionStorage)).toBeNull();
  });
});

describe('loadTenantBrand', () => {
  const tenant = { origin: 'http://acme.tenantry.localhost:8080', slug: 'acme' };

  it("fetches the workspace's public branding from its own address", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ name: 'Acme', primaryColor: '#0f62fe', logoUrl: '/api/tenants/acme/logo?v=1' }),
        ),
      );
    await expect(loadTenantBrand(tenant, fetchFn)).resolves.toEqual({
      name: 'Acme',
      primaryColor: '#0f62fe',
      logoUrl: 'http://acme.tenantry.localhost:8080/api/tenants/acme/logo?v=1',
    });
    expect(fetchFn).toHaveBeenCalledWith('http://acme.tenantry.localhost:8080/api/tenants/acme/branding');
  });

  it('gives up quietly, so the Tenantry brand shows', async () => {
    await expect(
      loadTenantBrand(tenant, vi.fn().mockRejectedValue(new Error('offline'))),
    ).resolves.toBeNull();
    await expect(
      loadTenantBrand(tenant, vi.fn().mockResolvedValue(new Response('', { status: 404 }))),
    ).resolves.toBeNull();
  });
});

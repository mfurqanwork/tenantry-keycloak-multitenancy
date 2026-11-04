import type { TenantRecord } from '@tenantry/db';
import { DirectoryError } from '@tenantry/keycloak-admin';
import { describe, expect, it, vi } from 'vitest';
import { perRealm } from './per-realm.js';

const tenant = (over: Partial<TenantRecord>): TenantRecord => ({
  id: 't1',
  slug: 'initech',
  name: 'Initech',
  status: 'active',
  tier: 'enterprise',
  realm: 'ent-initech',
  issuer: 'http://auth/realms/ent-initech',
  kcOrgId: null,
  templateVersion: 2,
  branding: { primaryColor: null, logoVersion: null },
  ...over,
});

describe('perRealm', () => {
  it("builds one client per realm with that realm's stored backend secret", async () => {
    const get = vi.fn().mockResolvedValue('s3cret');
    const make = vi.fn((realm: string, secret: string) => ({ realm, secret }));
    const forTenant = perRealm({ get, put: vi.fn() }, make);
    expect(await forTenant(tenant({}))).toEqual({ realm: 'ent-initech', secret: 's3cret' });
    await forTenant(tenant({}));
    expect(make).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('ent-initech/tenantry-backend');
  });

  it('fails as a directory error when the realm has no stored secret', async () => {
    const forTenant = perRealm({ get: vi.fn().mockResolvedValue(null), put: vi.fn() }, () => ({}));
    await expect(forTenant(tenant({}))).rejects.toBeInstanceOf(DirectoryError);
  });

  it('refuses a tenant without a realm of its own', async () => {
    const forTenant = perRealm({ get: vi.fn(), put: vi.fn() }, () => ({}));
    await expect(forTenant(tenant({ tier: 'standard', realm: 'platform' }))).rejects.toThrow(
      'tenant initech has no realm of its own',
    );
  });
});

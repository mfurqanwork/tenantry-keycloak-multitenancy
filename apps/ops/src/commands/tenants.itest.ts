import { platformRepository } from '@tenantry/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestOps } from '../testing/fixtures.js';
import { syncOrigins } from './tenants.js';

const t = createTestOps();
afterAll(() => t.close());

describe('ops tenants sync-origins', () => {
  it('registers both addresses of every active workspace, and a second run adds nothing new', async () => {
    const acme = await t.seedTenant();
    const failed = await t.seedTenant();
    await platformRepository(t.db).markTenantFailed(failed.id);
    expect(await syncOrigins(t.deps)).toBe(0);
    expect(t.directory.origins.web.has(`http://${acme.slug}.tenantry.localhost`)).toBe(true);
    expect(t.directory.origins.portal.has(`http://${acme.slug}.portal.tenantry.localhost`)).toBe(true);
    expect(t.directory.origins.web.has(`http://${failed.slug}.tenantry.localhost`)).toBe(false);
    const sizes = [t.directory.origins.web.size, t.directory.origins.portal.size];
    expect(await syncOrigins(t.deps)).toBe(0);
    expect([t.directory.origins.web.size, t.directory.origins.portal.size]).toEqual(sizes);
  });
});

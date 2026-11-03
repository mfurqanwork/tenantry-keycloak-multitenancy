import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { platformRepository } from '../src/repositories/platform.js';
import { connect } from './fixtures.js';

const conn = connect();
const platform = platformRepository(conn.db);
const slug = () => `e${randomUUID().slice(0, 8)}`;
afterAll(() => conn.close());

describe('platformRepository: enterprise tenants', () => {
  it('records an enterprise tenant with its realm and template version', async () => {
    const s = slug();
    const { id } = await platform.insertProvisioningTenant({ slug: s, name: 'Initech', tier: 'enterprise' });
    expect(await platform.findTenantBySlug(s)).toMatchObject({ tier: 'enterprise', status: 'provisioning' });
    await platform.activateTenant(id, {
      realm: `ent-${s}`,
      issuer: `http://auth/realms/ent-${s}`,
      kcOrgId: null,
      templateVersion: 1,
    });
    expect(await platform.findTenantBySlug(s)).toMatchObject({
      tier: 'enterprise',
      status: 'active',
      realm: `ent-${s}`,
      kcOrgId: null,
      templateVersion: 1,
    });
    await platform.setTemplateVersion(id, 2);
    expect((await platform.findTenantById(id))?.templateVersion).toBe(2);
  });

  it('keeps standard tenants as they were', async () => {
    const s = slug();
    const { id } = await platform.insertProvisioningTenant({ slug: s, name: 'Acme' });
    await platform.activateTenant(id, {
      realm: 'platform',
      issuer: 'http://auth/realms/platform',
      kcOrgId: 'org-1',
    });
    expect(await platform.findTenantBySlug(s)).toMatchObject({ tier: 'standard', templateVersion: null });
  });

  it('lists active tenants of one tier', async () => {
    const s = slug();
    const { id } = await platform.insertProvisioningTenant({ slug: s, name: 'Listed', tier: 'enterprise' });
    await platform.activateTenant(id, {
      realm: `ent-${s}`,
      issuer: 'http://i',
      kcOrgId: null,
      templateVersion: 1,
    });
    const enterprise = await platform.listActiveTenants({ tier: 'enterprise' });
    expect(enterprise.map((t) => t.slug)).toContain(s);
    expect(enterprise.every((t) => t.tier === 'enterprise')).toBe(true);
    expect((await platform.listActiveTenants({ tier: 'standard' })).map((t) => t.slug)).not.toContain(s);
  });
});

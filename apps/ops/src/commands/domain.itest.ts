import { listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestOps } from '../testing/fixtures.js';
import { claimDomain, verifyDomain } from './domain.js';

const t = createTestOps();
afterAll(() => t.close());
beforeEach(() => {
  t.out.length = 0;
  t.err.length = 0;
});

const token = () => /tenantry-verify=([A-Za-z0-9_-]+)/.exec(t.out.join('\n'))?.[1] ?? '';

describe('ops domain claim', () => {
  it('prints the TXT record to create, and the same one again for a second claim', async () => {
    const acme = await t.seedTenant();
    expect(await claimDomain(t.deps, { tenant: acme.slug, domain: `${acme.slug}.test` })).toBe(0);
    expect(t.out.join('\n')).toMatch(
      new RegExp(`_tenantry-verify\\.${acme.slug}\\.test TXT "tenantry-verify=[A-Za-z0-9_-]{43}"`),
    );
    const first = token();
    t.out.length = 0;
    await claimDomain(t.deps, { tenant: acme.slug, domain: `${acme.slug}.test` });
    expect(token()).toBe(first);
    const actions = (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 5 }))).map((e) => e.action);
    expect(actions).toEqual(['domain.claimed']);
  });

  it('refuses an unknown workspace', async () => {
    expect(await claimDomain(t.deps, { tenant: 'nobody-here', domain: 'x.test' })).toBe(1);
    expect(t.err.join('\n')).toMatch(/No active workspace/);
  });
});

describe('ops domain verify', () => {
  it('refuses until the record exists, then verifies', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    await claimDomain(t.deps, { tenant: acme.slug, domain });
    expect(await verifyDomain(t.deps, { tenant: acme.slug, domain })).toBe(1);
    expect(t.err.join('\n')).toMatch(/not found/);
    t.dns.set(`_tenantry-verify.${domain}`, ['something-else', `tenantry-verify=${token()}`]);
    expect(await verifyDomain(t.deps, { tenant: acme.slug, domain })).toBe(0);
    const actions = (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 5 }))).map((e) => e.action);
    expect(actions[0]).toBe('domain.verified');
  });

  it('refuses a domain another workspace has verified', async () => {
    const acme = await t.seedTenant();
    const globex = await t.seedTenant();
    const domain = `shared-${acme.slug}.test`;
    await claimDomain(t.deps, { tenant: acme.slug, domain });
    t.dns.set(`_tenantry-verify.${domain}`, [`tenantry-verify=${token()}`]);
    expect(await verifyDomain(t.deps, { tenant: acme.slug, domain })).toBe(0);
    t.out.length = 0;
    await claimDomain(t.deps, { tenant: globex.slug, domain });
    t.dns.set(`_tenantry-verify.${domain}`, [`tenantry-verify=${token()}`]);
    expect(await verifyDomain(t.deps, { tenant: globex.slug, domain })).toBe(1);
    expect(t.err.join('\n')).toBe(`${domain} is already verified by another workspace.`);
  });

  it('asks for a claim first', async () => {
    const acme = await t.seedTenant();
    expect(await verifyDomain(t.deps, { tenant: acme.slug, domain: 'unclaimed.test' })).toBe(1);
    expect(t.err.join('\n')).toMatch(/domain claim/);
  });
});

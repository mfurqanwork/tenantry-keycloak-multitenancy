import { listAudit, listIdps, tenantTx } from '@tenantry/db';
import { idpSecretKey } from '@tenantry/keycloak-admin';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestOps } from '../testing/fixtures.js';
import { claimDomain, verifyDomain } from './domain.js';
import { linkIdp } from './idp.js';

const t = createTestOps();
afterAll(() => t.close());
beforeEach(() => {
  t.out.length = 0;
  t.err.length = 0;
  t.directory.clearFailures();
});

const company = (alias: string, domain: string, tenant: string) => ({
  tenant,
  domain,
  alias,
  issuer: 'http://auth.tenantry.localhost/realms/corp-demo',
  clientId: 'tenantry-platform',
  clientSecret: 'secret',
});

async function verified(slug: string, domain: string) {
  t.out.length = 0;
  await claimDomain(t.deps, { tenant: slug, domain });
  const token = /tenantry-verify=([A-Za-z0-9_-]+)/.exec(t.out.join('\n'))?.[1] ?? '';
  t.dns.set(`_tenantry-verify.${domain}`, [`tenantry-verify=${token}`]);
  expect(await verifyDomain(t.deps, { tenant: slug, domain })).toBe(0);
}

describe('ops idp link', () => {
  it('guarantee: refuses an unverified domain and creates nothing in Keycloak', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    await claimDomain(t.deps, { tenant: acme.slug, domain });
    expect(await linkIdp(t.deps, company(`corp-${acme.slug}`, domain, acme.slug))).toBe(1);
    expect(t.err.join('\n')).toMatch(/not verified/);
    expect(t.directory.identityProviders.has(`corp-${acme.slug}`)).toBe(false);
    expect(t.directory.domainsOf(acme.kcOrgId)).toEqual([]);
  });

  it('links a verified domain to the identity provider, with an audit entry', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
    expect(t.directory.domainsOf(acme.kcOrgId)).toEqual([{ name: domain, identityProviderAlias: alias }]);
    expect(await tenantTx(t.db, acme.id, (tx) => listIdps(tx))).toEqual([expect.objectContaining({ alias })]);
    const actions = (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 1 }))).map((e) => e.action);
    expect(actions).toEqual(['idp.linked']);
    // A second run changes nothing and still succeeds.
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
  });

  it('link keeps the secret in the secrets store and nowhere else', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    expect(
      await linkIdp(t.deps, { ...company(alias, domain, acme.slug), clientSecret: 'first-secret' }),
    ).toBe(0);
    expect(t.secrets.get(idpSecretKey(alias))).toBe('first-secret');
    const rows = await tenantTx(t.db, acme.id, async (tx) => ({
      idps: await listIdps(tx),
      audit: await listAudit(tx, { limit: 5 }),
    }));
    expect(JSON.stringify(rows)).not.toContain('first-secret');
    expect([...t.out, ...t.err].join(' ')).not.toContain('first-secret');
    // A rerun changes nothing in Keycloak, so it keeps the secret Keycloak has.
    expect(
      await linkIdp(t.deps, { ...company(alias, domain, acme.slug), clientSecret: 'other-secret' }),
    ).toBe(0);
    expect(t.secrets.get(idpSecretKey(alias))).toBe('first-secret');
  });

  it('keeps the secret of a link made before Phase 5b when it is run again', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
    t.secrets.delete(idpSecretKey(alias));
    expect(await linkIdp(t.deps, { ...company(alias, domain, acme.slug), clientSecret: 'given-again' })).toBe(
      0,
    );
    expect(t.secrets.get(idpSecretKey(alias))).toBe('given-again');
  });

  it("refuses another workspace's alias", async () => {
    const acme = await t.seedTenant();
    const globex = await t.seedTenant();
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, `${acme.slug}.test`);
    expect(await linkIdp(t.deps, company(alias, `${acme.slug}.test`, acme.slug))).toBe(0);
    await verified(globex.slug, `${globex.slug}.test`);
    expect(await linkIdp(t.deps, company(alias, `${globex.slug}.test`, globex.slug))).toBe(1);
    expect(t.err.join('\n')).toMatch(/already used/);
    expect(t.directory.domainsOf(globex.kcOrgId)).toEqual([]);
  });

  it('refuses an alias that already exists in Keycloak for no workspace, and leaves that provider alone', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `manual-${acme.slug}`;
    await t.directory.createOidcIdentityProvider({
      alias,
      issuer: 'http://elsewhere/realms/x',
      clientId: 'someone-else',
      clientSecret: 'theirs',
    });
    await verified(acme.slug, domain);
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(1);
    expect(t.err.join(' ')).toMatch(/already exists in Keycloak/);
    expect(t.directory.identityProviders.get(alias)).toEqual({
      issuer: 'http://elsewhere/realms/x',
      clientId: 'someone-else',
    });
    expect(t.directory.domainsOf(acme.kcOrgId)).toEqual([]);
    expect(await tenantTx(t.db, acme.id, (tx) => listIdps(tx))).toEqual([]);
  });

  it('says so when the link is already in place', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
    t.out.length = 0;
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
    expect(t.out.join(' ')).toMatch(/already linked/);
  });

  it('keeps a provider it did not create when a later step fails on a re-run', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    expect(await linkIdp(t.deps, company(alias, domain, acme.slug))).toBe(0);
    t.directory.failOn('linkIdentityProvider');
    await expect(linkIdp(t.deps, company(alias, domain, acme.slug))).rejects.toThrow();
    expect(t.directory.identityProviders.has(alias)).toBe(true);
  });

  it('removes the identity provider again when linking fails', async () => {
    const acme = await t.seedTenant();
    const domain = `${acme.slug}.test`;
    const alias = `corp-${acme.slug}`;
    await verified(acme.slug, domain);
    t.directory.failOn('linkIdentityProvider');
    await expect(linkIdp(t.deps, company(alias, domain, acme.slug))).rejects.toThrow();
    expect(t.directory.identityProviders.has(alias)).toBe(false);
    expect(await tenantTx(t.db, acme.id, (tx) => listIdps(tx))).toEqual([]);
  });
});

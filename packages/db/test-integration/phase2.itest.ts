import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DomainTakenError } from '../src/errors.js';
import { deleteLogo, getLogo, putLogo } from '../src/repositories/branding.js';
import {
  claimDomain,
  findDomain,
  insertIdp,
  listIdps,
  markDomainVerified,
} from '../src/repositories/domains.js';
import { platformRepository } from '../src/repositories/platform.js';
import { tenantDomains, tenantIdps, tenantLogos } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, failure, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
const platform = platformRepository(conn.db);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
  await tenantTx(conn.db, a.tenantId, (tx) => putLogo(tx, { contentType: 'image/png', bytes: png }));
  await tenantTx(conn.db, a.tenantId, (tx) => claimDomain(tx, `${a.slug}.test`));
});
afterAll(() => conn.close());

describe('guarantee: phase 2 tenant tables are isolated', () => {
  it.each([
    ['tenant_logos', tenantLogos],
    ['tenant_domains', tenantDomains],
    ['tenant_idps', tenantIdps],
  ] as const)('%s shows another tenant nothing', async (_name, table) => {
    expect(await tenantTx(conn.db, b.tenantId, (tx) => tx.select().from(table))).toEqual([]);
    expect(await conn.db.select().from(table)).toEqual([]);
  });

  it('refuses a logo written for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx.insert(tenantLogos).values({ tenantId: b.tenantId, contentType: 'image/png', bytes: png }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it('refuses a domain claimed for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx.insert(tenantDomains).values({ tenantId: b.tenantId, domain: 'x.test', verificationToken: 't' }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it('refuses a logo over 256 KB', async () => {
    const reason = await failure(
      tenantTx(conn.db, b.tenantId, (tx) =>
        putLogo(tx, { contentType: 'image/png', bytes: Buffer.alloc(262145) }),
      ),
    );
    expect(reason).toMatch(/tenant_logos_size/);
  });
});

describe('logos', () => {
  it('keeps one logo per tenant and removes it', async () => {
    await tenantTx(conn.db, b.tenantId, (tx) => putLogo(tx, { contentType: 'image/png', bytes: png }));
    await tenantTx(conn.db, b.tenantId, (tx) => putLogo(tx, { contentType: 'image/webp', bytes: png }));
    const logo = await tenantTx(conn.db, b.tenantId, (tx) => getLogo(tx));
    expect(logo?.contentType).toBe('image/webp');
    expect(Buffer.compare(logo?.bytes ?? Buffer.alloc(0), png)).toBe(0);
    expect(await tenantTx(conn.db, b.tenantId, (tx) => deleteLogo(tx))).toBe(true);
    expect(await tenantTx(conn.db, b.tenantId, (tx) => getLogo(tx))).toBeNull();
    expect(await tenantTx(conn.db, b.tenantId, (tx) => deleteLogo(tx))).toBe(false);
  });
});

describe('domains', () => {
  it('returns the same token for a second claim', async () => {
    const first = await tenantTx(conn.db, a.tenantId, (tx) => claimDomain(tx, `${a.slug}.test`));
    const again = await tenantTx(conn.db, a.tenantId, (tx) => claimDomain(tx, `${a.slug}.test`));
    expect(again.verificationToken).toBe(first.verificationToken);
    expect(first.verificationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('lets only one tenant verify a domain', async () => {
    const domain = `shared-${a.slug}.test`;
    const mine = await tenantTx(conn.db, a.tenantId, (tx) => claimDomain(tx, domain));
    const theirs = await tenantTx(conn.db, b.tenantId, (tx) => claimDomain(tx, domain));
    await tenantTx(conn.db, a.tenantId, (tx) => markDomainVerified(tx, mine.id));
    await expect(
      tenantTx(conn.db, b.tenantId, (tx) => markDomainVerified(tx, theirs.id)),
    ).rejects.toBeInstanceOf(DomainTakenError);
    const found = await tenantTx(conn.db, a.tenantId, (tx) => findDomain(tx, domain));
    expect(found?.verifiedAt).toBeInstanceOf(Date);
  });

  it('records an identity provider against a domain', async () => {
    const domain = await tenantTx(conn.db, a.tenantId, (tx) => claimDomain(tx, `idp-${a.slug}.test`));
    await tenantTx(conn.db, a.tenantId, (tx) =>
      insertIdp(tx, { alias: `corp-${a.slug}`, domainId: domain.id }),
    );
    const idps = await tenantTx(conn.db, a.tenantId, (tx) => listIdps(tx));
    expect(idps).toEqual([expect.objectContaining({ alias: `corp-${a.slug}`, domainId: domain.id })]);
  });
});

describe('platformRepository: branding', () => {
  it('merges branding changes', async () => {
    await platform.setBranding(a.tenantId, { primaryColor: '#0f62fe' });
    expect(await platform.setBranding(a.tenantId, { logoVersion: 2 })).toEqual({
      primaryColor: '#0f62fe',
      logoVersion: 2,
    });
    expect((await platform.findTenantBySlug(a.slug))?.branding).toEqual({
      primaryColor: '#0f62fe',
      logoVersion: 2,
    });
  });

  it('reads missing keys as null', async () => {
    expect((await platform.findTenantBySlug(b.slug))?.branding).toEqual({
      primaryColor: null,
      logoVersion: null,
    });
  });

  it('finds active tenants by slug', async () => {
    const found = await platform.findActiveTenantsBySlugs([a.slug, b.slug, 'nope']);
    expect(found.map((t) => t.slug).sort()).toEqual([a.slug, b.slug].sort());
  });
});

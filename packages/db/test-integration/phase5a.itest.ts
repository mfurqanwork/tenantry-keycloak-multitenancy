import { createHash, randomBytes } from 'node:crypto';
import { SECURITY_DEFAULTS } from '@tenantry/auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findActiveScimToken,
  findScimTokenByHash,
  insertScimToken,
  lockTenantScim,
  revokeScimTokens,
  touchScimToken,
} from '../src/repositories/scim-tokens.js';
import { getSecurity, putSecurity } from '../src/repositories/security.js';
import { tenantScimTokens, tenantSecurity } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, failure, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
let a: SeededTenant;
let b: SeededTenant;
const hash = () => createHash('sha256').update(randomBytes(32)).digest();
const inAYear = () => new Date(Date.now() + 365 * 86400000);

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
  await tenantTx(conn.db, a.tenantId, async (tx) => {
    await insertScimToken(tx, { tokenHash: hash(), expiresAt: inAYear(), createdBy: a.userId });
    await putSecurity(tx, SECURITY_DEFAULTS, a.userId);
  });
});
afterAll(() => conn.close());

describe('guarantee: phase 5a tenant tables are isolated', () => {
  it.each([
    ['tenant_scim_tokens', tenantScimTokens],
    ['tenant_security', tenantSecurity],
  ] as const)('%s shows another tenant nothing, and nothing without a tenant', async (_name, table) => {
    expect(await tenantTx(conn.db, b.tenantId, (tx) => tx.select().from(table))).toEqual([]);
    expect(await conn.db.select().from(table)).toEqual([]);
  });

  it('refuses a token written for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx.insert(tenantScimTokens).values({ tenantId: b.tenantId, tokenHash: hash(), expiresAt: inAYear() }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it("finds a token's hash only inside its own tenant", async () => {
    const h = hash();
    await tenantTx(conn.db, a.tenantId, (tx) =>
      insertScimToken(tx, { tokenHash: h, expiresAt: inAYear(), createdBy: null }),
    );
    expect(await tenantTx(conn.db, a.tenantId, (tx) => findScimTokenByHash(tx, h))).not.toBeNull();
    expect(await tenantTx(conn.db, b.tenantId, (tx) => findScimTokenByHash(tx, h))).toBeNull();
  });
});

describe('scim tokens', () => {
  it('keeps one active token: a new one revokes the last, and revoking ends it', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      await lockTenantScim(tx);
      const first = await insertScimToken(tx, {
        tokenHash: hash(),
        expiresAt: inAYear(),
        createdBy: t.userId,
      });
      const second = await insertScimToken(tx, {
        tokenHash: hash(),
        expiresAt: inAYear(),
        createdBy: t.userId,
      });
      expect((await findActiveScimToken(tx))?.id).toBe(second.id);
      expect(first.id).not.toBe(second.id);
      expect(await revokeScimTokens(tx)).toBe(1);
      expect(await findActiveScimToken(tx)).toBeNull();
    });
  });

  it('refuses a second active token written behind the repository', async () => {
    const t = await seedTenant(conn.owner);
    const reason = await failure(
      tenantTx(conn.db, t.tenantId, async (tx) => {
        await tx.insert(tenantScimTokens).values({ tokenHash: hash(), expiresAt: inAYear() });
        await tx.insert(tenantScimTokens).values({ tokenHash: hash(), expiresAt: inAYear() });
      }),
    );
    expect(reason).toMatch(/tenant_scim_tokens_one_active/);
  });

  it('records the last use at most once a minute, and never hands out the hash', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      const made = await insertScimToken(tx, { tokenHash: hash(), expiresAt: inAYear(), createdBy: null });
      expect(made.lastUsedAt).toBeNull();
      expect(Object.keys(made)).not.toContain('tokenHash');
      await touchScimToken(tx, made.id);
      const once = (await findActiveScimToken(tx))?.lastUsedAt;
      expect(once).toBeInstanceOf(Date);
      await touchScimToken(tx, made.id);
      expect((await findActiveScimToken(tx))?.lastUsedAt?.getTime()).toBe(once?.getTime());
    });
  });
});

describe('security settings', () => {
  it('has none until saved, then reads back what was saved', async () => {
    const t = await seedTenant(conn.owner);
    await tenantTx(conn.db, t.tenantId, async (tx) => {
      expect(await getSecurity(tx)).toBeNull();
      const custom = { ...SECURITY_DEFAULTS, twoStep: 'required' as const, passwordMinLength: 16 };
      await putSecurity(tx, custom, t.userId);
      expect(await getSecurity(tx)).toEqual(custom);
      await putSecurity(tx, SECURITY_DEFAULTS, t.userId);
      expect(await getSecurity(tx)).toEqual(SECURITY_DEFAULTS);
    });
  });

  it('refuses a value the database does not know', async () => {
    const t = await seedTenant(conn.owner);
    const reason = await failure(
      tenantTx(conn.db, t.tenantId, (tx) =>
        putSecurity(tx, { ...SECURITY_DEFAULTS, twoStep: 'sometimes' as 'off' }, t.userId),
      ),
    );
    expect(reason).toMatch(/tenant_security_two_step/);
  });
});

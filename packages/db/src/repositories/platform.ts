import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { isUniqueViolation, SlugTakenError } from '../errors.js';
import {
  identities,
  tenantIdentity,
  tenants,
  users,
  type TenantBranding,
  type TenantStatus,
} from '../schema/index.js';
import type { Executor } from './executor.js';

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  realm: string | null;
  issuer: string | null;
  kcOrgId: string | null;
  branding: TenantBranding;
}

const brandingOf = (stored: Partial<TenantBranding> | null): TenantBranding => ({
  primaryColor: stored?.primaryColor ?? null,
  logoVersion: stored?.logoVersion ?? null,
});

export interface IdentityInput {
  issuer: string;
  subject: string;
  email: string | null;
  displayName: string | null;
}

// The only access to tables that span tenants (tenants, tenant_identity, users, identities).
export function platformRepository(ex: Executor) {
  const selectTenants = () =>
    ex
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        realm: tenantIdentity.realm,
        issuer: tenantIdentity.issuer,
        kcOrgId: tenantIdentity.kcOrgId,
        branding: tenants.branding,
      })
      .from(tenants)
      .leftJoin(tenantIdentity, eq(tenantIdentity.tenantId, tenants.id));

  const findTenant = async (where: ReturnType<typeof eq>): Promise<TenantRecord | null> => {
    const [row] = await selectTenants().where(and(where, eq(tenants.tier, 'standard')));
    return row ? { ...row, branding: brandingOf(row.branding) } : null;
  };

  return {
    findTenantBySlug: (slug: string) => findTenant(eq(tenants.slug, slug)),
    findTenantById: (id: string) => findTenant(eq(tenants.id, id)),

    async findActiveTenantsBySlugs(slugs: string[]): Promise<TenantRecord[]> {
      if (slugs.length === 0) return [];
      const rows = await selectTenants().where(
        and(inArray(tenants.slug, slugs), eq(tenants.status, 'active'), eq(tenants.tier, 'standard')),
      );
      return rows.map((row) => ({ ...row, branding: brandingOf(row.branding) }));
    },

    // Merges into the stored object: setting the colour keeps the logo version, and the other way round.
    async setBranding(tenantId: string, patch: Partial<TenantBranding>): Promise<TenantBranding> {
      const [row] = await ex
        .update(tenants)
        .set({ branding: sql`${tenants.branding} || ${JSON.stringify(patch)}::jsonb` })
        .where(eq(tenants.id, tenantId))
        .returning({ branding: tenants.branding });
      if (!row) throw new Error(`tenant ${tenantId} not found`);
      return brandingOf(row.branding);
    },

    // A failed signup leaves its row behind, and so does one whose process died mid-way (still
    // provisioning after ten minutes); the next signup for that slug replaces either.
    async insertProvisioningTenant(input: { slug: string; name: string }): Promise<{ id: string }> {
      try {
        return await ex.transaction(async (tx) => {
          await tx
            .delete(tenants)
            .where(
              and(
                eq(tenants.slug, input.slug),
                or(
                  eq(tenants.status, 'failed'),
                  and(
                    eq(tenants.status, 'provisioning'),
                    lt(tenants.createdAt, sql`now() - interval '10 minutes'`),
                  ),
                ),
              ),
            );
          const [row] = await tx.insert(tenants).values(input).returning({ id: tenants.id });
          if (!row) throw new Error('insert returned no row');
          return row;
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw new SlugTakenError(input.slug);
        throw err;
      }
    },

    async activateTenant(
      id: string,
      identity: { realm: string; issuer: string; kcOrgId: string },
    ): Promise<void> {
      await ex.insert(tenantIdentity).values({ tenantId: id, ...identity });
      await ex.update(tenants).set({ status: 'active' }).where(eq(tenants.id, id));
    },

    async markTenantFailed(id: string): Promise<void> {
      await ex.update(tenants).set({ status: 'failed' }).where(eq(tenants.id, id));
    },

    async upsertIdentity(input: IdentityInput): Promise<{ userId: string }> {
      const [existing] = await ex
        .select({ userId: identities.userId })
        .from(identities)
        .where(and(eq(identities.issuer, input.issuer), eq(identities.subject, input.subject)));
      if (existing) return existing;
      return ex.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: input.email, displayName: input.displayName })
          .returning({ id: users.id });
        if (!user) throw new Error('insert returned no row');
        // A concurrent first login may have won; keep its row and drop ours with the transaction.
        const [inserted] = await tx
          .insert(identities)
          .values({ userId: user.id, issuer: input.issuer, subject: input.subject })
          .onConflictDoNothing()
          .returning({ userId: identities.userId });
        if (inserted) return inserted;
        const [winner] = await tx
          .select({ userId: identities.userId })
          .from(identities)
          .where(and(eq(identities.issuer, input.issuer), eq(identities.subject, input.subject)));
        if (!winner) throw new Error('identity vanished during upsert');
        await tx.delete(users).where(eq(users.id, user.id));
        return winner;
      });
    },

    async userIdsForSubjects(issuer: string, subjects: string[]): Promise<Map<string, string>> {
      if (subjects.length === 0) return new Map();
      const rows = await ex
        .select({ subject: identities.subject, userId: identities.userId })
        .from(identities)
        .where(and(eq(identities.issuer, issuer), inArray(identities.subject, subjects)));
      return new Map(rows.map((r) => [r.subject, r.userId]));
    },

    async subjectForUser(userId: string, issuer: string): Promise<string | null> {
      const [row] = await ex
        .select({ subject: identities.subject })
        .from(identities)
        .where(and(eq(identities.userId, userId), eq(identities.issuer, issuer)));
      return row?.subject ?? null;
    },

    async usersByIds(
      ids: string[],
    ): Promise<Map<string, { email: string | null; displayName: string | null }>> {
      if (ids.length === 0) return new Map();
      const rows = await ex.select().from(users).where(inArray(users.id, ids));
      return new Map(rows.map((u) => [u.id, { email: u.email, displayName: u.displayName }]));
    },
  };
}

export type PlatformRepository = ReturnType<typeof platformRepository>;

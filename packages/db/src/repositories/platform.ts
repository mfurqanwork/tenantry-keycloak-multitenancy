import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { isUniqueViolation, SlugTakenError } from '../errors.js';
import {
  identities,
  tenantIdentity,
  tenants,
  users,
  type TenantBranding,
  type TenantStatus,
  type TenantTier,
} from '../schema/index.js';
import type { Executor } from './executor.js';

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  // Standard: an organization in the platform realm. Enterprise: its own realm (ADR-0001).
  tier: TenantTier;
  realm: string | null;
  issuer: string | null;
  kcOrgId: string | null;
  // The realm template an enterprise tenant was built from or last upgraded to; null for Standard.
  templateVersion: number | null;
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
        tier: tenants.tier,
        realm: tenantIdentity.realm,
        issuer: tenantIdentity.issuer,
        kcOrgId: tenantIdentity.kcOrgId,
        templateVersion: tenantIdentity.templateVersion,
        branding: tenants.branding,
      })
      .from(tenants)
      .leftJoin(tenantIdentity, eq(tenantIdentity.tenantId, tenants.id));

  const findTenant = async (where: ReturnType<typeof eq>): Promise<TenantRecord | null> => {
    const [row] = await selectTenants().where(where);
    return row ? { ...row, branding: brandingOf(row.branding) } : null;
  };

  // Which realm and issuer the guard accepts for this tenant. Writing it again replaces it (a resumed
  // provisioning run).
  const registerIdentity = async (
    id: string,
    identity: { realm: string; issuer: string; kcOrgId: string | null; templateVersion?: number },
  ): Promise<void> => {
    await ex
      .insert(tenantIdentity)
      .values({ tenantId: id, ...identity })
      .onConflictDoUpdate({ target: tenantIdentity.tenantId, set: identity });
  };

  const markTenantActive = async (id: string): Promise<void> => {
    await ex.update(tenants).set({ status: 'active' }).where(eq(tenants.id, id));
  };

  return {
    findTenantBySlug: (slug: string) => findTenant(eq(tenants.slug, slug)),
    findTenantById: (id: string) => findTenant(eq(tenants.id, id)),

    async listActiveTenants(o: { tier?: TenantTier } = {}): Promise<TenantRecord[]> {
      const rows = await selectTenants()
        .where(and(eq(tenants.status, 'active'), o.tier ? eq(tenants.tier, o.tier) : undefined))
        .orderBy(tenants.slug);
      return rows.map((row) => ({ ...row, branding: brandingOf(row.branding) }));
    },

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
    // provisioning after ten minutes); the next signup for that slug replaces either. An enterprise
    // row is never replaced: rerunning the provisioning finishes it.
    async insertProvisioningTenant(input: {
      slug: string;
      name: string;
      tier?: TenantTier;
    }): Promise<{ id: string }> {
      try {
        return await ex.transaction(async (tx) => {
          await tx.delete(tenants).where(
            and(
              eq(tenants.slug, input.slug),
              // Only Standard signups are replaced; an operator finishes an enterprise run (ADR-0010).
              eq(tenants.tier, 'standard'),
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

    registerIdentity,
    markTenantActive,

    async activateTenant(
      id: string,
      identity: { realm: string; issuer: string; kcOrgId: string | null; templateVersion?: number },
    ): Promise<void> {
      await registerIdentity(id, identity);
      await markTenantActive(id);
    },

    async setTemplateVersion(id: string, templateVersion: number): Promise<void> {
      await ex.update(tenantIdentity).set({ templateVersion }).where(eq(tenantIdentity.tenantId, id));
    },

    async markTenantFailed(id: string): Promise<void> {
      await ex.update(tenants).set({ status: 'failed' }).where(eq(tenants.id, id));
    },

    async upsertIdentity(input: IdentityInput): Promise<{ userId: string }> {
      const [existing] = await ex
        .select({ userId: identities.userId })
        .from(identities)
        .where(and(eq(identities.issuer, input.issuer), eq(identities.subject, input.subject)));
      if (existing) {
        // Keycloak owns email and name: keep ours in step with the newest token.
        await ex
          .update(users)
          .set({ email: input.email, displayName: input.displayName })
          .where(
            and(
              eq(users.id, existing.userId),
              or(
                sql`${users.email} is distinct from ${input.email}`,
                sql`${users.displayName} is distinct from ${input.displayName}`,
              ),
            ),
          );
        return existing;
      }
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

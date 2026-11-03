import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DomainTakenError, isUniqueViolation } from '../errors.js';
import { tenantDomains, tenantIdps } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface DomainRecord {
  id: string;
  domain: string;
  verificationToken: string;
  verifiedAt: Date | null;
}

export interface IdpRecord {
  alias: string;
  domainId: string;
  createdAt: Date;
}

const columns = {
  id: tenantDomains.id,
  domain: tenantDomains.domain,
  verificationToken: tenantDomains.verificationToken,
  verifiedAt: tenantDomains.verifiedAt,
};

export async function findDomain(tx: TenantTx, domain: string): Promise<DomainRecord | null> {
  const [row] = await tx
    .select(columns)
    .from(tenantDomains)
    .where(eq(tenantDomains.domain, domain.toLowerCase()));
  return row ?? null;
}

// Claiming again returns the existing claim, so a TXT record the person already created stays valid.
export async function claimDomain(tx: TenantTx, domain: string): Promise<DomainRecord> {
  const existing = await findDomain(tx, domain);
  if (existing) return existing;
  const [row] = await tx
    .insert(tenantDomains)
    .values({ domain: domain.toLowerCase(), verificationToken: randomBytes(32).toString('base64url') })
    .returning(columns);
  if (!row) throw new Error('insert returned no row');
  return row;
}

// Another tenant that verified the domain first wins (the partial unique index sees every tenant).
export async function markDomainVerified(tx: TenantTx, id: string): Promise<void> {
  const [row] = await tx.select(columns).from(tenantDomains).where(eq(tenantDomains.id, id));
  try {
    // A savepoint, so a refused verification leaves the caller's transaction usable.
    await tx.transaction(async (sp) => {
      await sp
        .update(tenantDomains)
        .set({ verifiedAt: sql`now()` })
        .where(and(eq(tenantDomains.id, id), isNull(tenantDomains.verifiedAt)));
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainTakenError(row?.domain ?? 'This domain');
    throw err;
  }
}

export async function insertIdp(tx: TenantTx, input: { alias: string; domainId: string }): Promise<void> {
  await tx.insert(tenantIdps).values(input);
}

export function listIdps(tx: TenantTx): Promise<IdpRecord[]> {
  return tx
    .select({ alias: tenantIdps.alias, domainId: tenantIdps.domainId, createdAt: tenantIdps.createdAt })
    .from(tenantIdps);
}

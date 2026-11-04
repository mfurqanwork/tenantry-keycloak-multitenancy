import { desc, eq, sql } from 'drizzle-orm';
import type { AppType } from '@tenantry/auth';
import { tenantApps } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

export interface AppRecord {
  id: string;
  clientId: string;
  kcClientUuid: string;
  name: string;
  type: AppType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AppInput = Omit<AppRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type AppPatch = Pick<AppRecord, 'name' | 'redirectUris' | 'postLogoutRedirectUris' | 'webOrigins'>;

const columns = {
  id: tenantApps.id,
  clientId: tenantApps.clientId,
  kcClientUuid: tenantApps.kcClientUuid,
  name: tenantApps.name,
  type: tenantApps.type,
  redirectUris: tenantApps.redirectUris,
  postLogoutRedirectUris: tenantApps.postLogoutRedirectUris,
  webOrigins: tenantApps.webOrigins,
  createdBy: tenantApps.createdBy,
  createdAt: tenantApps.createdAt,
  updatedAt: tenantApps.updatedAt,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No tenant filter here on purpose: row-level security supplies it.
export function listApps(tx: TenantTx): Promise<AppRecord[]> {
  return tx.select(columns).from(tenantApps).orderBy(desc(tenantApps.createdAt));
}

export async function getApp(tx: TenantTx, id: string): Promise<AppRecord | null> {
  if (!UUID.test(id)) return null;
  const [row] = await tx.select(columns).from(tenantApps).where(eq(tenantApps.id, id));
  return row ?? null;
}

export async function countApps(tx: TenantTx): Promise<number> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(tenantApps);
  return row?.n ?? 0;
}

export async function createApp(tx: TenantTx, input: AppInput): Promise<AppRecord> {
  const [row] = await tx.insert(tenantApps).values(input).returning(columns);
  if (!row) throw new Error('insert returned no row');
  return row;
}

export async function updateApp(tx: TenantTx, id: string, patch: AppPatch): Promise<AppRecord | null> {
  if (!UUID.test(id)) return null;
  const { name, redirectUris, postLogoutRedirectUris, webOrigins } = patch;
  const [row] = await tx
    .update(tenantApps)
    .set({ name, redirectUris, postLogoutRedirectUris, webOrigins, updatedAt: sql`clock_timestamp()` })
    .where(eq(tenantApps.id, id))
    .returning(columns);
  return row ?? null;
}

export async function deleteApp(tx: TenantTx, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await tx.delete(tenantApps).where(eq(tenantApps.id, id)).returning({ id: tenantApps.id });
  return rows.length > 0;
}

// Holds a per-tenant lock until the transaction ends, so the app cap is checked and used by one
// registration at a time.
export async function lockTenantApps(tx: TenantTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('apps:' || current_setting('app.tenant_id')))`);
}

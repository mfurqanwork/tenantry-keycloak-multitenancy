import { eq } from 'drizzle-orm';
import { tenantConsoleAccess } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

// False when the person already had it.
export async function grantConsole(
  tx: TenantTx,
  input: { userId: string; grantedBy: string | null },
): Promise<boolean> {
  const rows = await tx
    .insert(tenantConsoleAccess)
    .values(input)
    .onConflictDoNothing()
    .returning({ userId: tenantConsoleAccess.userId });
  return rows.length > 0;
}

// False when the person did not have it.
export async function revokeConsole(tx: TenantTx, userId: string): Promise<boolean> {
  const rows = await tx
    .delete(tenantConsoleAccess)
    .where(eq(tenantConsoleAccess.userId, userId))
    .returning({ userId: tenantConsoleAccess.userId });
  return rows.length > 0;
}

export async function listConsole(tx: TenantTx): Promise<string[]> {
  const rows = await tx.select({ userId: tenantConsoleAccess.userId }).from(tenantConsoleAccess);
  return rows.map((r) => r.userId);
}

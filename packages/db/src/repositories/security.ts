import { sql } from 'drizzle-orm';
import type { SecuritySettings } from '@tenantry/auth';
import { tenantSecurity } from '../schema/index.js';
import type { TenantTx } from '../tenant-tx.js';

const columns = {
  twoStep: tenantSecurity.twoStep,
  passwordMinLength: tenantSecurity.passwordMinLength,
  passwordHistory: tenantSecurity.passwordHistory,
  passwordExpiryDays: tenantSecurity.passwordExpiryDays,
  sessionIdleMinutes: tenantSecurity.sessionIdleMinutes,
  sessionMaxHours: tenantSecurity.sessionMaxHours,
  lockoutFailures: tenantSecurity.lockoutFailures,
  lockoutWaitMinutes: tenantSecurity.lockoutWaitMinutes,
  scimDefaultRole: tenantSecurity.scimDefaultRole,
};

// Null until an owner saves; the realm then runs on the template's defaults.
export async function getSecurity(tx: TenantTx): Promise<SecuritySettings | null> {
  const [row] = await tx.select(columns).from(tenantSecurity);
  return row ?? null;
}

export async function putSecurity(
  tx: TenantTx,
  s: SecuritySettings,
  updatedBy: string | null,
): Promise<void> {
  const values = {
    twoStep: s.twoStep,
    passwordMinLength: s.passwordMinLength,
    passwordHistory: s.passwordHistory,
    passwordExpiryDays: s.passwordExpiryDays,
    sessionIdleMinutes: s.sessionIdleMinutes,
    sessionMaxHours: s.sessionMaxHours,
    lockoutFailures: s.lockoutFailures,
    lockoutWaitMinutes: s.lockoutWaitMinutes,
    scimDefaultRole: s.scimDefaultRole,
    updatedBy,
  };
  await tx
    .insert(tenantSecurity)
    .values(values)
    .onConflictDoUpdate({
      target: tenantSecurity.tenantId,
      set: { ...values, updatedAt: sql`clock_timestamp()` },
    });
}

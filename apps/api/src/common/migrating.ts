import type { TenantRecord, TenantStatus } from '@tenantry/db';
import { ConflictProblem } from './http-errors.js';

export const FREEZE = 'This workspace is moving to Enterprise. Try again in a few minutes.';

// A workspace that is moving stays open for reads and sign-in until its cut-over (ADR-0025).
export const isOpen = (status: TenantStatus): boolean => status === 'active' || status === 'migrating';

// People, roles, invites and branding wait while a workspace moves, so nothing is lost mid-copy.
export function assertNotMigrating(tenant: TenantRecord): void {
  if (tenant.status === 'migrating') throw new ConflictProblem(FREEZE);
}

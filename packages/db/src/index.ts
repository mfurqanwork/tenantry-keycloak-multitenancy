export { createAppPool, pingDatabase } from './client.js';
export type { Pool } from 'pg';
export { createDb, type Db } from './db.js';
export { runMigrations } from './migrate.js';
export * from './schema/index.js';
export { tenantTx, type TenantTx } from './tenant-tx.js';
export { DomainTakenError, OpenInviteExistsError, SlugTakenError } from './errors.js';
export { deleteLogo, getLogo, putLogo, type LogoRecord } from './repositories/branding.js';
export {
  claimDomain,
  findDomain,
  insertIdp,
  listIdps,
  markDomainVerified,
  type DomainRecord,
  type IdpRecord,
} from './repositories/domains.js';
export { insertAudit, listAudit, type AuditEntry } from './repositories/audit.js';
export type { Executor } from './repositories/executor.js';
export {
  createInvite,
  findOpenInviteByEmail,
  hasRevokedInvite,
  listOpenInvites,
  markInviteAccepted,
  revokeInvite,
  type InviteRecord,
} from './repositories/invites.js';
export {
  platformRepository,
  type IdentityInput,
  type PlatformRepository,
  type TenantRecord,
} from './repositories/platform.js';
export { createProject, getProject, listProjects, type ProjectRecord } from './repositories/projects.js';
export { lockTenantMembership } from './repositories/membership-lock.js';

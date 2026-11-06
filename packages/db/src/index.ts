export { createAppPool, pingDatabase } from './client.js';
export type { Pool } from 'pg';
export { createDb, type Db } from './db.js';
export { runMigrations } from './migrate.js';
export * from './schema/index.js';
export { tenantTx, type TenantTx } from './tenant-tx.js';
export { DomainTakenError, isUniqueViolation, OpenInviteExistsError, SlugTakenError } from './errors.js';
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
export {
  countApps,
  createApp,
  deleteApp,
  getApp,
  listApps,
  lockTenantApps,
  updateApp,
  type AppInput,
  type AppPatch,
  type AppRecord,
} from './repositories/apps.js';
export {
  findActiveScimToken,
  findScimTokenByHash,
  insertScimToken,
  lockTenantScim,
  revokeScimTokens,
  touchScimToken,
  type ScimTokenRecord,
} from './repositories/scim-tokens.js';
export { getSecurity, putSecurity } from './repositories/security.js';
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
export {
  cutOver,
  getMigration,
  markAborted,
  markCutOver,
  markFinished,
  startMigration,
  type MigrationRecord,
} from './repositories/migrations.js';
export { grantConsole, listConsole, revokeConsole } from './repositories/console-access.js';
export { getReadUntil, listAuditSince, markRead, openInvitesForEmail } from './repositories/notifications.js';

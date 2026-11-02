import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Role } from '@tenantry/auth';
import { tenantIdColumn } from './tenant-column.js';
import { users } from './users.js';

export const tenantInvites = pgTable(
  'tenant_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    email: text('email').notNull(),
    role: text('role').$type<Role>().notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    check('tenant_invites_role', sql`${t.role} in ('owner', 'admin', 'member')`),
    uniqueIndex('tenant_invites_one_open')
      .on(t.tenantId, sql`lower(${t.email})`)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
);

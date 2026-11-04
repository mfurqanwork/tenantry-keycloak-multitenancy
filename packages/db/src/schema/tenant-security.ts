import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ScimDefaultRole, TwoStep } from '@tenantry/auth';
import { tenants } from './tenants.js';
import { users } from './users.js';

// An enterprise realm's sign-in rules as its owners set them; the bounds are checks in migration 0004.
export const tenantSecurity = pgTable('tenant_security', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .default(sql`nullif(current_setting('app.tenant_id', true), '')::uuid`)
    .references(() => tenants.id, { onDelete: 'cascade' }),
  twoStep: text('two_step').$type<TwoStep>().notNull(),
  passwordMinLength: integer('password_min_length').notNull(),
  passwordHistory: integer('password_history').notNull(),
  passwordExpiryDays: integer('password_expiry_days').notNull(),
  sessionIdleMinutes: integer('session_idle_minutes').notNull(),
  sessionMaxHours: integer('session_max_hours').notNull(),
  lockoutFailures: integer('lockout_failures').notNull(),
  lockoutWaitMinutes: integer('lockout_wait_minutes').notNull(),
  scimDefaultRole: text('scim_default_role').$type<ScimDefaultRole>().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`clock_timestamp()`),
});

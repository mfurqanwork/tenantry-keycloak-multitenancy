import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// A Standard workspace's move into a realm of its own (ADR-0025), one row per tenant.
export const tenantMigrations = pgTable('tenant_migrations', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .default(sql`nullif(current_setting('app.tenant_id', true), '')::uuid`)
    .references(() => tenants.id, { onDelete: 'cascade' }),
  fromOrgId: text('from_org_id').notNull(),
  realm: text('realm').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  cutOverAt: timestamp('cut_over_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  abortedAt: timestamp('aborted_at', { withTimezone: true }),
});

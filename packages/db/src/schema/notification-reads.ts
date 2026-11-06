import { sql } from 'drizzle-orm';
import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

// How far each person has read their notifications in a workspace (ADR-0028).
export const notificationReads = pgTable(
  'notification_reads',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .default(sql`nullif(current_setting('app.tenant_id', true), '')::uuid`)
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readUntil: timestamp('read_until', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

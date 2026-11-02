import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';
import { users } from './users.js';

// Append-only: the app role may insert and select, nothing else.
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    target: text('target').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_newest').on(t.tenantId, t.createdAt.desc(), t.id.desc())],
);

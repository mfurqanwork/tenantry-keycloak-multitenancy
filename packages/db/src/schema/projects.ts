import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';
import { users } from './users.js';

// The example business table: the row-level security pattern every tenant table follows.
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

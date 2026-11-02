import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Our own user id; never keyed by Keycloak's id (see identities).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

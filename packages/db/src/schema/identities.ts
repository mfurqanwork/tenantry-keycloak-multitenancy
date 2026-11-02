import { pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// (issuer, subject) → our user; a realm migration adds a row instead of changing ids.
export const identities = pgTable(
  'identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
  },
  (t) => [unique('identities_issuer_subject').on(t.issuer, t.subject)],
);

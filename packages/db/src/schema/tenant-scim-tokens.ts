import { sql } from 'drizzle-orm';
import { customType, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';
import { users } from './users.js';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

// A tenant's SCIM token, kept only as its SHA-256 hash (ADR-0024).
export const tenantScimTokens = pgTable(
  'tenant_scim_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    tokenHash: bytea('token_hash').notNull().unique('tenant_scim_tokens_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('tenant_scim_tokens_one_active')
      .on(t.tenantId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

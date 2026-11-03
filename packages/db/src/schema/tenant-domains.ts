import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';

// An email domain a tenant claims; verified once its DNS TXT record carries the token (ADR-0022).
export const tenantDomains = pgTable('tenant_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  domain: text('domain').notNull(),
  verificationToken: text('verification_token').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

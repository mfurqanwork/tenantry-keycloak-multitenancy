import { customType, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

// One logo per tenant, at most 256 KB; served publicly for the login page and the apps.
export const tenantLogos = pgTable('tenant_logos', {
  tenantId: tenantIdColumn().primaryKey(),
  contentType: text('content_type').notNull(),
  bytes: bytea('bytes').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

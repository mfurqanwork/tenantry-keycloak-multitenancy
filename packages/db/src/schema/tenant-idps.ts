import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant-column.js';
import { tenantDomains } from './tenant-domains.js';

// A company identity provider linked to the tenant's organization for one verified domain.
export const tenantIdps = pgTable(
  'tenant_idps',
  {
    tenantId: tenantIdColumn(),
    alias: text('alias').notNull().unique('tenant_idps_alias'),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => tenantDomains.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.alias] })],
);

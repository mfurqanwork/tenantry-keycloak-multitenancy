import { sql } from 'drizzle-orm';
import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

// Who an owner let into the realm's Keycloak console (ADR-0026).
export const tenantConsoleAccess = pgTable(
  'tenant_console_access',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .default(sql`nullif(current_setting('app.tenant_id', true), '')::uuid`)
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

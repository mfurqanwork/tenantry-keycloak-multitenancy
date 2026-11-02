import { sql } from 'drizzle-orm';
import { uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// Tenant tables fill tenant_id from the transaction's app.tenant_id, never from a parameter.
export const tenantIdColumn = () =>
  uuid('tenant_id')
    .notNull()
    .default(sql`nullif(current_setting('app.tenant_id', true), '')::uuid`)
    .references(() => tenants.id, { onDelete: 'cascade' });

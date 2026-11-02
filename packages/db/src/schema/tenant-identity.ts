import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// One row per tenant; the guard's issuer rule reads it.
export const tenantIdentity = pgTable('tenant_identity', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  realm: text('realm').notNull(),
  issuer: text('issuer').notNull(),
  kcOrgId: text('kc_org_id'),
  templateVersion: integer('template_version'),
});

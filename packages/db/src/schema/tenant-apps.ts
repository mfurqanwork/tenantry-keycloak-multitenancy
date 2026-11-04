import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { AppType } from '@tenantry/auth';
import { tenantIdColumn } from './tenant-column.js';
import { users } from './users.js';

// A customer application of an enterprise tenant (ADR-0011). Keycloak holds its client and secret.
export const tenantApps = pgTable(
  'tenant_apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    clientId: text('client_id').notNull(),
    kcClientUuid: text('kc_client_uuid').notNull(),
    name: text('name').notNull(),
    type: text('type').$type<AppType>().notNull(),
    redirectUris: text('redirect_uris')
      .array()
      .notNull()
      .default(sql`'{}'`),
    postLogoutRedirectUris: text('post_logout_redirect_uris')
      .array()
      .notNull()
      .default(sql`'{}'`),
    webOrigins: text('web_origins')
      .array()
      .notNull()
      .default(sql`'{}'`),
    // Null when an operator registered the app.
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    check('tenant_apps_name', sql`char_length(${t.name}) between 1 and 80`),
    check('tenant_apps_type', sql`${t.type} in ('web', 'spa', 'native', 'm2m')`),
    unique('tenant_apps_client_id').on(t.tenantId, t.clientId),
  ],
);

import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export type TenantStatus = 'provisioning' | 'active' | 'failed';

// Spans tenants: reached only through platformRepository.
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    tier: text('tier').notNull().default('standard'),
    status: text('status').$type<TenantStatus>().notNull().default('provisioning'),
    branding: jsonb('branding').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('tenants_tier', sql`${t.tier} in ('standard', 'enterprise')`),
    check('tenants_status', sql`${t.status} in ('provisioning', 'active', 'failed')`),
  ],
);

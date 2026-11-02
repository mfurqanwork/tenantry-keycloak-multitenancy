# ADR-0016: Drizzle ORM with SQL RLS policies and a tenantTx helper

Status: Accepted · Date: 2026-11-02

## Context

ADR-0006 requires every tenant query to run inside a transaction that first runs `SET LOCAL app.tenant_id`.

## Decision

Use Drizzle ORM with drizzle-kit migrations. RLS policies are written as SQL in migrations. `packages/db` exports `tenantTx(ctx, fn)`, which opens a transaction, sets the tenant and runs `fn`. It is the only way handlers reach tenant tables, and a lint rule forbids importing the raw client elsewhere.

## Alternatives considered

- Prisma: RLS with `SET LOCAL` needs interactive transactions and extensions, and fights its connection handling.
- Kysely: a similar fit, with more hand-written code.

## Consequences

- Migrations run as `tenantry_owner`; the app runs as `tenantry_app`.
- Isolation tests assert that a query without a filter still returns only the current tenant's rows.

# ADR-0006: Shared tables with forced row-level security

Status: Accepted · Date: 2026-11-02

## Context

A single missing `WHERE tenant_id = ...` must not leak data between tenants.

## Decision

Every tenant-owned table has `tenant_id` and a forced RLS policy comparing it to `current_setting('app.tenant_id')`. The API connects as `tenantry_app`, which owns no tables and lacks `BYPASSRLS`, and sets the tenant with `SET LOCAL` inside each request's transaction. Cross-tenant tables are reached only through a narrow repository used by the auth layer and operator tools.

## Alternatives considered

- Schema per tenant: migration overhead grows with tenant count.
- Database per tenant: too costly for the Standard tier.

## Consequences

- All tenant queries run in a transaction (`tenantTx`).
- Connection pooling must stay in transaction mode, so `SET LOCAL` never leaks across requests.

# ADR-0004: Enterprise-tier roles as client roles

Status: Accepted · Date: 2026-11-02

## Context

In an enterprise realm the realm itself is the tenant, so any role there is already tenant-scoped.

## Decision

Roles `owner`, `admin` and `member` are client roles on the `tenantry-api` client in each enterprise realm. The guard reads them from `resource_access.tenantry-api.roles`.

## Alternatives considered

- Realm roles: would collide with roles the customer defines for their own apps.

## Consequences

- The product-client template defines these roles.
- Customer apps can define their own roles without touching ours.

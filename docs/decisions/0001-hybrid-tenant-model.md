# ADR-0001: Hybrid tenant model

Status: Accepted · Date: 2026-11-02

## Context

Tenantry must serve many small tenants cheaply and a few large tenants that need strong isolation, their own policies and their own connected apps. One Keycloak realm per tenant does not scale to thousands of tenants, and a single shared realm cannot give a customer its own policies or apps.

## Decision

Standard tenants are Keycloak Organizations in one shared `platform` realm. Enterprise tenants each get a dedicated realm `ent-<slug>`, created from a versioned template. Application code sees one `TenantContext` and never branches on tier.

## Alternatives considered

- Realm per tenant for everyone: strong isolation, but Keycloak slows down with hundreds of realms and SSO across tenants is lost.
- Shared realm only: cheap, but no per-tenant policies, SCIM credentials or customer apps.

## Consequences

- Two token shapes the auth guard must handle (ADR-0003, ADR-0004).
- A migration path from Standard to Enterprise is needed (Phase 5), made possible by ADR-0007.
- Realm count must be measured; the scale ceiling is published in Phase 6.

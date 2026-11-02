# ADR-0005: Subdomain picks the tenant; the token must prove it

Status: Accepted · Date: 2026-11-02

## Context

The client must never be able to choose which tenant it acts in. Headers and body fields are client-controlled.

## Decision

The tenant slug comes from the request host (`<slug>.tenantry.<domain>`). The tenant's `tenant_identity` row gives the expected issuer, and for Standard tenants the organization alias. A token is accepted only if its `iss` equals that issuer exactly and, for Standard, it carries `organization.<alias>`. Any tenant id header is ignored.

## Alternatives considered

- Tenant id header: trivially spoofable.
- Tenant from the token only: breaks for users in several organizations.

## Consequences

- Local dev needs wildcard hostnames (`*.tenantry.localhost`).
- Hosting needs a wildcard DNS record and certificate.

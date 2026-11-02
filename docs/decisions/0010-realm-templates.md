# ADR-0010: Versioned realm templates applied by our own code

Status: Accepted · Date: 2026-11-02

## Context

Enterprise realms must stay consistent as the template evolves. The plan left open whether to use keycloak-config-cli or direct Admin API calls.

## Decision

Realm configuration lives in versioned JSON templates (`infra/keycloak/templates/enterprise-realm.vN.json` plus product-client templates). Our own TypeScript code in `packages/keycloak-admin` applies them through the Admin API, driven by `provision-enterprise-tenant` and `upgrade-enterprise-realms` (which has a dry run). Each realm records its template version in `tenant_identity`. Provisioning uses a master-realm service account that holds only `create-realm`; per-realm work uses that realm's `tenantry-backend` credential.

## Alternatives considered

- keycloak-config-cli: declarative and less code, but an extra process that is harder to drive per tenant from our API and to audit.

## Consequences

- We write and test diffing and idempotency ourselves.
- Provisioning is a product feature with audit entries, not an ops script.

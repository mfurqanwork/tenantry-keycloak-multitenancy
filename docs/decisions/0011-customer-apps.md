# ADR-0011: Customer apps: Enterprise tier only

Status: Accepted · Date: 2026-11-02

## Context

Enterprise customers want to plug their own apps into Tenantry's login. In the shared realm, a customer's client could see users of other tenants.

## Decision

Only enterprise tenants can register apps. Registration goes through our API, which validates redirect URIs (HTTPS only except localhost, no wildcard hosts, a cap per tenant). Keycloak client policies in the realm template enforce the same rules again. Secrets are shown once and never stored in our database.

## Alternatives considered

- Allow apps in the shared realm with a membership authenticator: possible later, deferred.

## Consequences

- Five app types are supported (web, SPA, native, machine-to-machine, SAML).
- Connection details and snippets are generated per realm.

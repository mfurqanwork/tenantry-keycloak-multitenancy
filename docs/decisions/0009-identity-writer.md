# ADR-0009: Our API is the only writer of identity data

Status: Accepted · Date: 2026-11-02

## Context

If tenants, organizations, members and clients could change from several places (admin console, scripts, API), auditing and reasoning about state would be hard.

## Decision

All identity writes go through our API, which calls the Keycloak Admin and Organization APIs from `packages/keycloak-admin` and writes an `audit_log` row for every change. The Keycloak admin console is for operators debugging, not for routine changes.

## Alternatives considered

- Let tenant admins use the Keycloak console: no audit trail in our system, and easy to break invariants.

## Consequences

- Our API needs Keycloak service credentials (see ADR-0010).
- Optional scoped console access for enterprise IT (Phase 5) is an explicit, audited exception.

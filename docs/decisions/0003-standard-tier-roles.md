# ADR-0003: Standard-tier roles from organization groups

Status: Accepted · Date: 2026-11-02

## Context

In the shared realm a user may belong to several organizations with different roles. Top-level `realm_access` mixes roles from every organization, so reading it would let an admin of org A act as admin in org B.

## Decision

Each organization has groups `/owners`, `/admins` and `/members`, with realm roles mapped onto them. The API reads roles only from `organization.<alias>.realm_access` in the token, for the alias of the tenant the request is for. Top-level `realm_access` is never read.

## Alternatives considered

- A role sync table in our database: duplicates Keycloak state and drifts.
- Client roles per organization: does not scale in one realm.

## Consequences

- The `organization` client scope must emit roles per organization; the platform realm config covers this.
- An isolation test covers a user who is admin in A and member in B.

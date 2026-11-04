# ADR-0007: Own users table plus identities keyed by issuer and subject

Status: Accepted · Date: 2026-11-02 · Updated: 2026-11-07 (Phase 5b)

## Context

A Keycloak user id is only unique within a realm. When a tenant moves from the shared realm to its own realm, its users get new Keycloak ids.

## Decision

Our `users` table has our own ids. An `identities` table maps (issuer, subject) to a user and is unique on that pair. A user is created on first login. A realm migration adds new identity rows pointing at the same user.

## Alternatives considered

- Key data by Keycloak `sub`: migration would orphan all data.

## Consequences

- One extra lookup per request, which is cacheable.
- Emails are not used as keys.

## Update (Phase 5b)

The move this ADR planned for is built ([ADR-0025](0025-standard-to-enterprise.md)): each moved person gets a second `identities` row, from the new realm's issuer and Keycloak id to the same `users.id`, and keeps the shared-realm one for any other workspace they are in.

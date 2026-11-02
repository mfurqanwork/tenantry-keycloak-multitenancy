# ADR-0008: Permissions from a role-to-permission map

Status: Accepted · Date: 2026-11-02

## Context

Checking role names in code spreads policy across the codebase and makes it hard to test.

## Decision

`packages/auth` holds a static map from role to permissions (`members:invite`, `apps:register` and so on). The guard resolves permissions once per request. Handlers use `@RequirePermission(...)` and never check roles.

## Alternatives considered

- OPA or another external policy engine: more power than this project needs, and an extra service.

## Consequences

- Changing what a role can do is a one-line change with a unit test.

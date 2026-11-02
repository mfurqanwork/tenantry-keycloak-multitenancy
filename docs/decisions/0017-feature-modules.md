# ADR-0017: Feature modules behind two interfaces

Status: Accepted · Date: 2026-11-02

## Context

Phase 1 adds the first real features: signup, members, audit and projects. Each one touches the database and Keycloak. Without a rule, every service would grow its own SQL and its own HTTP calls, and the isolation rules in AGENTS.md would rest on reviewers noticing.

## Decision

- The API has one folder per feature under `apps/api/src/modules/<name>/`: module, controller, service, Zod schemas, and tests next to them. A module exports only its service.
- Services reach the outside world through two interfaces only:
  - `@tenantry/db` repositories and `tenantTx` for Postgres;
  - `IdentityDirectory` from `@tenantry/keycloak-admin` for Keycloak, injected as `IDENTITY_DIRECTORY`.
- `apps/api/src/infrastructure/` is the one place that binds those interfaces to Postgres and to Keycloak over HTTP.
- `@tenantry/keycloak-admin/testing` ships `InMemoryIdentityDirectory`. One contract test runs against it and against the real Keycloak, so the fake cannot drift.
- The web app mirrors this: `apps/web/src/features/<name>/` holds a route, its dialogs and its tests; `apps/web/src/lib/` holds the shared pieces.
- ESLint enforces the boundaries:
  - `pg` and `drizzle-orm/node-postgres` only in `packages/db`;
  - `oidc-client-ts` only in `packages/oidc-client`;
  - `createHttpIdentityDirectory` only in `apps/api/src/infrastructure`;
  - a module imports another module's service or module file, never its internals.
    `scripts/lib/lint-rules.test.mjs` proves each rule fires.

## Alternatives considered

- Layered folders (`controllers/`, `services/`, `repositories/`): familiar, but one feature ends up spread across the tree.
- Hexagonal modules with domain, application and infrastructure layers each: more rigorous, about three times the files at this size.

## Consequences

- A feature is read and reviewed in one folder.
- Most API tests use the fake directory and the real Postgres; the contract test keeps the fake honest. The contract already caught one drift: Keycloak keeps organization names unique and the fake did not.

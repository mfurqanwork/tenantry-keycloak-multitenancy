# ADR-0014: NestJS for the API

Status: Accepted · Date: 2026-11-02

## Context

The API needs a single request guard, dependency injection for the Keycloak and database clients, and a structure an AI coding agent can follow.

## Decision

Use NestJS 11 with a global `TenantAuthGuard`, a `@RequirePermission` decorator, zod-validated config, Terminus health checks and pino logging.

## Alternatives considered

- Fastify or Express alone: we would hand-build the module, guard and DI structure.
- Spring Boot or .NET: strong options, but a second language in the repo.

## Consequences

- Decorators need SWC in Vitest.
- Guards and interceptors map one-to-one onto the plan's auth boundary.

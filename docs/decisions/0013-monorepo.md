# ADR-0013: pnpm + Turborepo TypeScript monorepo

Status: Accepted · Date: 2026-11-02

## Context

The API, two SPAs, a login theme, shared packages and scripts must share types (`TenantContext`, permissions) and run in one CI.

## Decision

Use a single pnpm workspace with Turborepo for task caching, TypeScript strict everywhere, ESLint (typescript-eslint strict) and Prettier, Vitest for unit tests, and Node 22.

## Alternatives considered

- Polyrepo: shared types would need publishing.
- Nx: heavier than needed.

## Consequences

- One lockfile and one CI workflow.
- Package boundaries are enforced by AGENTS.md and lint rules.

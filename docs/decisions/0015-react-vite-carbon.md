# ADR-0015: React + Vite SPAs with IBM Carbon

Status: Accepted · Date: 2026-11-02

## Context

The plan makes our apps public PKCE clients that pick their realm at runtime from the subdomain. It also chooses IBM Carbon for an enterprise look, accessibility and dense data views.

## Decision

`apps/web` and `apps/portal` are Vite + React 19 SPAs on `@carbon/react` v11, with shared setup and the five page patterns in `packages/ui`. Login uses authorization code with PKCE, and silent login uses a `prompt=none` redirect, not an iframe.

## Alternatives considered

- Next.js with a backend-for-frontend: tokens stay server-side, but it changes the client model the plan describes and complicates per-tenant subdomains.

## Consequences

- Tokens live in browser memory and are short-lived (5 minutes).
- Static hosting (for example Vercel) works for the SPAs; the API and Keycloak are hosted separately.

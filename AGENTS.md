# AGENTS.md

Guidance for AI coding agents and humans working in this repository. Read it before changing code.

## Layout

- `apps/api`: the NestJS API. Every request passes `TenantAuthGuard` (`src/auth/`). Features live in `src/modules/<name>/` (module, controller, service, Zod schemas, tests); a module exports only its service (ADR-0017). `src/infrastructure/` is the only place that binds Postgres and Keycloak.
- `apps/web`, `apps/portal`: the React + Vite SPAs, built on `@tenantry/ui`. Web pages live in `apps/web/src/features/<name>/`; shared pieces (API client, `ApiErrorNotification`, `FormDialog`, `useMe`) in `apps/web/src/lib/`.
- `packages/ui`: Carbon setup, `AppShell`, and the five page patterns.
- `packages/db`: the Drizzle schema, SQL migrations and row-level security policies.
- `packages/auth`: `TenantContext`, the roles, and the role-to-permission map.
- `packages/keycloak-admin`: the only code that calls Keycloak admin endpoints, behind `IdentityDirectory`; `/testing` has the in-memory fake.
- `packages/oidc-client`: the only code that imports `oidc-client-ts`.
- `tests/isolation`: the README guarantees, run against the whole stack.
- `infra/`: Compose, Caddy, the Keycloak realm and the Postgres init script.
- `docs/decisions/`: ADRs. A change to a recorded decision needs a new or updated ADR.

## Commands

| Command                                                     | Does                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev:stack`                                            | The whole stack in Docker                                                     |
| `pnpm dev`                                                  | Infrastructure in Docker; the API, web and portal on the host with hot reload |
| `pnpm smoke`                                                | Checks the running stack                                                      |
| `pnpm test:isolation`                                       | The guarantees and integration tests against the running stack                |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | What CI runs                                                                  |
| `pnpm stack:down`                                           | Stops the stack                                                               |

## Hard rules

These keep tenant isolation intact. A change that breaks one of them is wrong, even if tests pass.

1. Never query tenant tables outside `tenantTx`. Only `packages/db` imports `pg` or `drizzle-orm/node-postgres`; lint enforces this, as it does the other import boundaries in ADR-0017.
2. Never read the top-level `realm_access` claim. Standard-tier roles come only from `organization.<alias>.realm_access`; enterprise roles come from `resource_access.tenantry-api`.
3. Never trust a tenant id from the client. The subdomain picks the tenant, and the token must prove it.
4. Never call Keycloak admin endpoints from outside `packages/keycloak-admin`.
5. Every identity change writes an audit entry.
6. Every new tenant table or endpoint gets an isolation test.
7. Code checks permissions (`@RequirePermission`), never role names.

## UI rules

- Every new screen starts from a `@tenantry/ui` page pattern: `ListPage`, `DetailPage`, `SettingsPage`, `DashboardPage` or `WizardPage`.
- Use Carbon components and `@carbon/icons-react` only. Don't add another component library.
- Colour, spacing and type come from Carbon tokens (`$spacing-*`, theme tokens, `type-style`). stylelint rejects raw `px`/`rem` sizes, `box-shadow`, `border-radius` and gradients.
- The header is always dark (`g100`). The page follows the user's light or dark choice.

## Conventions

- TypeScript strict everywhere. ESM with `.js` import specifiers.
- Tests sit next to the code (`*.test.ts(x)`) and run with Vitest. Write the failing test first.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Configuration comes from the environment and is validated at startup; add new variables to `.env.example`.

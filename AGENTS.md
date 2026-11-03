# AGENTS.md

Guidance for AI coding agents and humans working in this repository. Read it before changing code.

## Layout

- `apps/api`: the NestJS API. Every request passes `TenantAuthGuard` (`src/auth/`). Features live in `src/modules/<name>/` (module, controller, service, Zod schemas, tests); a module exports only its service (ADR-0017). `src/infrastructure/` is the only place that binds Postgres and Keycloak.
- `apps/web`, `apps/portal`: the React + Vite SPAs, built on `@tenantry/ui`. Pages live in `src/features/<name>/` of each app.
- `apps/login-theme`: the Keycloakify login theme, built into the Keycloak image (ADR-0021).
- `packages/app-kit`: what both apps share: `TenantAuth` (sign-in for a tenant host), the API client, `ApiErrorNotification`, `FormDialog`, `useMe`.
- `packages/brand`: the colour maths for tenant branding (contrast, suggested shade, Carbon tokens).
- `packages/ui`: Carbon setup, `AppShell`, and the five page patterns.
- `packages/db`: the Drizzle schema, SQL migrations and row-level security policies.
- `packages/auth`: `TenantContext`, the roles, and the role-to-permission map.
- `packages/keycloak-admin`: the only code that calls Keycloak admin endpoints, behind `IdentityDirectory`, `MemberDirectory`, `RealmProvisioner` and `RealmApps` (customer apps, ADR-0011); `/testing` has the in-memory fakes, `/secrets` the secrets store, and `templates/` the versioned enterprise realm and product-client templates (ADR-0010).
- `packages/oidc-client`: the only code that imports `oidc-client-ts`.
- `tests/isolation`: the README guarantees, run against the whole stack.
- `examples/customer-app`: an outside app on an enterprise realm (`pnpm example:customer-app`); `pnpm seed` writes its git-ignored `.env`.
- `apps/ops`: the operator command line (`pnpm ops`). It calls Keycloak through `packages/keycloak-admin` with its own service account, `tenantry-ops`, and builds enterprise tenants through the API's operator endpoints.
- `infra/`: Compose, Caddy, the Keycloak realms (`platform`, and the dev-only `corp-demo`), CoreDNS (dev only) and the Postgres init script.
- `docs/decisions/`: ADRs. A change to a recorded decision needs a new or updated ADR.

## Commands

| Command                                                     | Does                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev:stack`                                            | The whole stack in Docker                                                                                                            |
| `pnpm dev`                                                  | Infrastructure in Docker; the API, web and portal on the host with hot reload                                                        |
| `pnpm smoke`                                                | Checks the running stack                                                                                                             |
| `pnpm test:isolation`                                       | The guarantees and integration tests against the running stack                                                                       |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | What CI runs                                                                                                                         |
| `pnpm ops <command>`                                        | Operator commands: enterprise tenants and their apps, company domains and identity providers, origins (ADR-0010, ADR-0011, ADR-0022) |
| `pnpm stack:down`                                           | Stops the stack                                                                                                                      |

## Hard rules

These keep tenant isolation intact. A change that breaks one of them is wrong, even if tests pass.

1. Never query tenant tables outside `tenantTx`. Only `packages/db` imports `pg` or `drizzle-orm/node-postgres`; lint enforces this, as it does the other import boundaries in ADR-0017.
2. Never read the top-level `realm_access` claim. Standard-tier roles come only from `organization.<alias>.groups`; enterprise roles come from `resource_access.tenantry-api`.
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

# Tenantry — Phase 0 design: decisions and foundations

Date: 2026-11-02 · Status: draft for review

## Purpose

Phase 0 gives Tenantry a working skeleton before any identity features exist. When it is done, someone who clones the repo can run one command and see every service start. They can also read why each major choice was made. CI proves the skeleton builds and passes its tests.

Tenantry is a portfolio project: an open-source, multi-tenant identity platform on Keycloak. The domain design lives in the project plan doc ("Hybrid Multi-Tenant Identity Platform — Project Plan"). The ADRs in `docs/decisions/` record its decisions inside the repo.

## Exit criteria

1. On Windows, macOS or Linux with Docker, a fresh clone runs `pnpm install && pnpm dev:stack` (a wrapper around `docker compose up`), and the stack becomes healthy.
2. `http://auth.tenantry.localhost/realms/platform/.well-known/openid-configuration` returns the platform realm's discovery document. Its `issuer` is `http://auth.tenantry.localhost/realms/platform`.
3. `http://demo.tenantry.localhost` shows the web app's Carbon shell. `http://demo.portal.tenantry.localhost` shows the portal's shell. `http://demo.tenantry.localhost/api/health` returns `{"status":"ok"}`, with the database and Keycloak checks passing.
4. GitHub Actions runs lint, typecheck, unit tests and build on every push and PR, and all of them pass.
5. 16 ADRs exist, and README, AGENTS.md, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT and LICENSE (MIT) are in place.

Out of Phase 0: login, tenants, database tables beyond a migrations baseline, and any Keycloak Admin API calls. All of these start in Phase 1.

## Repository layout

The pnpm workspace uses Turborepo and TypeScript 5 in strict mode. `tsconfig.base.json` holds the shared settings, and each package extends it.

| Path                                              | Phase 0 content                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`                                        | NestJS 11 app with a `/api/health` endpoint (Terminus checks for Postgres and the Keycloak discovery doc), config loaded from env with zod validation, and pino logging                                                                                      |
| `apps/web`                                        | Vite + React 19 SPA that renders `AppShell` from `packages/ui` with a placeholder dashboard page                                                                                                                                                             |
| `apps/portal`                                     | Same as web, with a different product name in the header                                                                                                                                                                                                     |
| `packages/ui`                                     | Carbon setup: g10/g100 themes that follow the OS, an always-dark header, IBM Plex, the `AppShell`, and five page-pattern templates (`ListPage`, `DetailPage`, `SettingsPage`, `DashboardPage`, `WizardPage`) with Storybook-free example usage in `apps/web` |
| `packages/db`                                     | Drizzle and drizzle-kit config, plus a baseline migration that creates the `tenantry_app` role's grants. No tables yet                                                                                                                                       |
| `packages/auth`                                   | Empty package, with types for `TenantContext` and the permission union (for Phase 1)                                                                                                                                                                         |
| `packages/keycloak-admin`, `packages/oidc-client` | Stubs with a README stating their single responsibility                                                                                                                                                                                                      |
| `infra/`                                          | `docker-compose.yml`, `Caddyfile`, `keycloak/platform-realm.json`, `postgres/init.sql`                                                                                                                                                                       |
| `docs/decisions`                                  | ADR-0001 to ADR-0016                                                                                                                                                                                                                                         |

`apps/login-theme`, `scripts/`, `examples/` and `tests/isolation` are created in the phases that first need them.

## Local stack

| Service     | Image                                                           | Reached at                                               |
| ----------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| caddy       | `caddy:2`                                                       | host :80; Docker network alias `auth.tenantry.localhost` |
| keycloak    | `quay.io/keycloak/keycloak:26.8.x` (exact patch pinned)         | `auth.tenantry.localhost`                                |
| postgres    | `postgres:17`                                                   | one server with two databases: `tenantry` and `keycloak` |
| mailpit     | `axllent/mailpit`                                               | `mail.tenantry.localhost`                                |
| api         | built from `apps/api` (dev: `pnpm --filter api dev` with watch) | `/api/*` on any tenant host                              |
| web, portal | Vite dev servers in containers, with HMR through Caddy          | `*.tenantry.localhost`, `*.portal.tenantry.localhost`    |

- **Caddy routing.** `auth.` goes to Keycloak and `mail.` to Mailpit. On `*.portal.tenantry.localhost`, `/api/*` goes to the API and everything else to portal. On `*.tenantry.localhost`, `/api/*` goes to the API and everything else to web. The original `Host` header is passed through, so the API can read the tenant slug in Phase 1.
- **Keycloak settings.** `KC_HOSTNAME=http://auth.tenantry.localhost` and `KC_HTTP_ENABLED=true`, both dev only. The master admin comes from `.env`. `--import-realm` loads `platform-realm.json`, which has Organizations enabled, an empty client list and token lifetimes from the plan (5-minute access tokens).
- **Postgres roles.** `postgres/init.sql` creates the `tenantry_owner` role (owns the schema, runs migrations) and the `tenantry_app` role (login, no ownership, no `BYPASSRLS`). The API connects only as `tenantry_app`.
- **Secrets.** `.env.example` is committed and `.env` is gitignored. On first run `pnpm dev:stack` copies `.env.example` to `.env` if `.env` is missing.
- **Health checks.** Every service has one, and api, web and portal wait for postgres and keycloak to be healthy.

**Windows note:** `*.localhost` names resolve to 127.0.0.1 in Chrome, Edge and Firefox. Node scripts on the host use `127.0.0.1` with a `Host` header where needed.

## Design system foundation (packages/ui)

These rules follow the plan's Design system section:

- `@carbon/react` v11 and `@carbon/icons-react` only, with no other component library.
- The `ThemeProvider` picks `g10` or `g100` from `prefers-color-scheme`, with a user override stored in localStorage. The header always renders inside a `g100` Theme zone.
- Spacing, colour and type come only from Carbon tokens and the productive type scale; custom pixel values fail lint (a stylelint rule on `.scss`).
- `applyBrand(color)` is stubbed for now. It will override the `--cds-interactive*` and `--cds-button-primary*` tokens in Phase 2.
- **Page patterns:**
  - Each one is a typed component that takes slots (header with breadcrumb, title and primary action; body; empty state).
  - Phase 0 renders each pattern once on a `/patterns` route in `apps/web`, for visual checks.
  - AGENTS.md requires every new screen to start from one of these patterns.

## Docs and repo hygiene

- **README:** a pitch, the "Guarantees" table (rows marked _planned_ until their tests exist), quick start, an architecture diagram (Mermaid), a tier comparison and links to the ADRs.
- **AGENTS.md:** layout, commands, conventions, and the plan's hard rules verbatim, plus these:
  - Screens start from a page pattern.
  - Use Carbon components and tokens only.
  - Only `packages/keycloak-admin` calls Keycloak admin endpoints.
  - Only `tenantTx` touches tenant tables.
- **Other files:** CONTRIBUTING (setup, Conventional Commits, PR checklist), SECURITY (reporting, a short threat model), CODE_OF_CONDUCT (Contributor Covenant 2.1), LICENSE (MIT), and `.github/` issue and PR templates.

## CI

`.github/workflows/ci.yml` runs on Node 22 with a pnpm cache. Its steps are `pnpm install --frozen-lockfile`, then `turbo run lint typecheck test build`. ESLint uses typescript-eslint strict and Prettier. Unit tests use Vitest in every package; the API uses Vitest with SWC for NestJS decorators. Phase 0 adds no compose-based job. That job arrives with the isolation suite in Phase 1.

## Testing in Phase 0

- `apps/api`: the health controller unit test uses mocked indicators. The config schema test checks that a missing env var throws.
- `packages/ui`: a Vitest + Testing Library test renders each page pattern and `AppShell` in both themes, and the header always carries the g100 class.
- A smoke script, `pnpm smoke`, runs against the live stack. It curls the discovery doc and `/api/health` and checks that the issuer matches. It is a manual check in Phase 0 and runs in CI from Phase 1.

## ADR list

| #    | Title                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ |
| 0001 | Hybrid tenant model: shared realm with Organizations, realm per enterprise tenant                |
| 0002 | Keycloak 26.8.x, version pinned                                                                  |
| 0003 | Standard-tier roles from organization groups, read only from `organization.<alias>.realm_access` |
| 0004 | Enterprise-tier roles as client roles on `tenantry-api`                                          |
| 0005 | Subdomain picks the tenant; the token must prove it                                              |
| 0006 | Shared tables, `tenant_id` on every row, forced RLS, non-owner app role                          |
| 0007 | Own users table plus identities keyed by issuer and subject                                      |
| 0008 | Permissions from a role-to-permission map; code checks permissions                               |
| 0009 | Our API is the only writer of identity data                                                      |
| 0010 | Versioned realm templates applied by our own Admin API code                                      |
| 0011 | Customer apps: Enterprise tier only, with enforced client policies                               |
| 0012 | Keycloak native SCIM per enterprise realm                                                        |
| 0013 | pnpm + Turborepo TypeScript monorepo                                                             |
| 0014 | NestJS for the API                                                                               |
| 0015 | React + Vite SPAs with IBM Carbon                                                                |
| 0016 | Drizzle ORM with SQL RLS policies and a `tenantTx` helper                                        |

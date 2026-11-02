# Tenantry — Phase 1 design: Standard tenant core

Date: 2026-11-02 · Status: draft for review

## Purpose

Phase 1 turns the skeleton into a working multi-tenant app for Standard tenants. A person signs up, creates a workspace, invites colleagues, gives them roles, and works with tenant data. Every one of those actions is isolated per tenant and recorded in an audit log. The seven Phase 1 rows of the security test suite prove the isolation against the real Keycloak and Postgres.

The domain design comes from the project plan doc ("Data model", "Auth boundary", "Phase 1"). This spec adds the decisions that doc leaves open, plus the code structure.

## Decisions taken for this phase

| Topic              | Decision                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup             | Keycloak first: the person registers or signs in on the Keycloak login page, then fills a "Create workspace" wizard in our app. Our code never handles passwords.                                           |
| Invites            | Keycloak's organization invite (`invite-user`). We store the intended role and apply it on the invitee's first request.                                                                                     |
| Isolation tests    | CI starts the compose stack and runs `pnpm test:isolation` against it. The same command runs locally.                                                                                                       |
| Roles in Keycloak  | Organization groups `owners`, `admins`, `members` inside each organization. Keycloak 26.8.1 has organization groups and an "Organization Group Membership" token mapper (checked against the local server). |
| Code structure     | Feature modules behind interfaces (see "Code structure").                                                                                                                                                   |
| Token verification | `jose`, with a remote key set cached per issuer.                                                                                                                                                            |
| SPA login          | `oidc-client-ts`, wrapped by `@tenantry/oidc-client`. Authorization code with PKCE.                                                                                                                         |
| SPA routing        | `react-router` 7 in data mode. This also fixes the Phase 0 deferred minor "side-nav links reload the page".                                                                                                 |
| Errors             | Every API error is an RFC 9457 problem document (`application/problem+json`), produced by one global exception filter.                                                                                      |

## Exit criteria

1. A new person opens `http://tenantry.localhost`, registers in Keycloak, creates the workspace `acme`, and lands on `http://acme.tenantry.localhost` signed in as its owner.
2. The owner invites `bob@example.com` as admin. The invite email arrives in Mailpit. Bob accepts, signs in at `acme.tenantry.localhost`, and is an admin there.
3. Members, Audit log and Projects pages work, each gated by permissions. A member sees no invite, remove or role controls, and the API refuses those calls with 403.
4. `pnpm test:isolation` passes the seven Phase 1 rows against the running stack, locally and in CI. The README guarantees table marks them `tested`.
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes. A fresh clone still starts with `pnpm dev:stack`, and `pnpm smoke` passes.

Out of Phase 1: the portal app's login and SSO across apps, tenant switching, branding, back-channel logout, domain linking, Enterprise tenants, deleting a tenant, and email verification. The `deleted_at` column exists but nothing sets it yet.

## Code structure

The goal is that a person can open one feature folder and understand that feature without reading the rest. Dependencies point one way: features → interfaces → infrastructure.

### API (`apps/api/src`)

```
main.ts, app.module.ts
config/                 env validation (exists)
common/
  problem.filter.ts     the global RFC 9457 exception filter
  zod.pipe.ts           request validation from a Zod schema
auth/
  tenant-auth.guard.ts  the eight resolution steps; the only place a token becomes a TenantContext
  token-verifier.ts     jose verification, key set cached per issuer
  role-claims.ts        reads roles from this tenant's organization block only
  invite-claimer.ts     applies a pending invite's role on first request
  decorators.ts         @RequirePermission, @SignedInOnly, @Public, @Ctx()
  host.ts               slug from the Host header
modules/
  tenants/              GET /api/tenants/:slug/auth-config, GET /api/me
  signup/               slug availability, POST /api/signup, its saga
  members/              list, invite, revoke invite, change role, remove
  audit/                AuditService (used by other modules), GET /api/audit
  projects/             the row-level security example: list and create
health/                 (exists)
```

Each module folder holds `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.schemas.ts` (Zod request and response schemas) and tests next to them. A module exports only its service. Controllers do no work beyond validation and calling the service. Services never import `pg`, `drizzle-orm/node-postgres` or `fetch` Keycloak themselves.

### Packages

| Package                    | Phase 1 responsibility                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@tenantry/db`             | `src/schema/<table>.ts` (one file per table), SQL migrations with row-level security, `tenantTx`, `platformRepository` (the only access to tables that span tenants), and one repository per tenant table (`invitesRepository`, `auditRepository`, `projectsRepository`) taking the transaction handle |
| `@tenantry/auth`           | `Role`, `Permission`, `permissionsFor`, `TenantContext`, plus `highestRole(roles)`. Adds `projects:read` and `projects:write`                                                                                                                                                                          |
| `@tenantry/keycloak-admin` | The `IdentityDirectory` interface (organizations, organization groups, members, invites), its HTTP implementation using a client-credentials token, and `InMemoryIdentityDirectory` exported from `@tenantry/keycloak-admin/testing` for unit tests                                                    |
| `@tenantry/oidc-client`    | `createAuthClient(config)`, `AuthProvider`, `useAuth()`, and `fetchAuthConfig(slug)`. The only frontend code that knows about OIDC                                                                                                                                                                     |
| `@tenantry/ui`             | Unchanged patterns. `AppShell` takes a `renderLink` prop so the router's link is used for navigation                                                                                                                                                                                                   |
| `tests/isolation`          | A new private workspace package with the security suite and its helpers                                                                                                                                                                                                                                |

### Web (`apps/web/src`)

```
main.tsx, router.tsx      routes; apex host → signup, tenant host → the tenant app
lib/api.ts                fetch wrapper: adds the token, parses problem documents
lib/host.ts               apex or tenant slug from the hostname
features/
  signup/                 SignupRoute (WizardPage), its API calls
  members/                MembersRoute (ListPage), InviteDialog, ChangeRoleDialog
  audit/                  AuditRoute (ListPage)
  projects/               ProjectsRoute (ListPage), CreateProjectDialog
  dashboard/              (exists, moved from routes/)
  patterns/               (exists, moved from routes/)
```

### Rules enforced by lint

- Outside `packages/db`, nothing imports `pg` or `drizzle-orm/node-postgres` (exists).
- Outside `packages/keycloak-admin`, nothing imports its `http` implementation directly; the API binds it once in `app.module.ts`.
- Outside `packages/oidc-client`, nothing imports `oidc-client-ts`.
- `apps/api/src/modules/*` never imports another module's internals, only its exported service.

## Data model

Migrations are hand-written SQL in `packages/db/migrations`, with Drizzle schema files matching them. Every id is a UUID generated by Postgres (`gen_random_uuid()`); every timestamp is `timestamptz`.

| Table             | Columns                                                                                                                         | Access                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `tenants`         | id, slug (unique), name, tier (`standard`), status (`provisioning`, `active`, `failed`), branding jsonb, created_at, deleted_at | Spans tenants; `platformRepository` only                    |
| `tenant_identity` | tenant_id (pk, fk), realm, issuer, kc_org_id, template_version (null for Standard)                                              | Spans tenants; `platformRepository` only                    |
| `users`           | id, email, display_name, created_at                                                                                             | Spans tenants; `platformRepository` only                    |
| `identities`      | id, user_id (fk), issuer, subject, unique (issuer, subject)                                                                     | Spans tenants; `platformRepository` only                    |
| `tenant_invites`  | id, tenant_id, email, role, invited_by, created_at, accepted_at, revoked_at; unique open invite per (tenant_id, lower(email))   | Row-level security                                          |
| `audit_log`       | id, tenant_id, actor_user_id, action, target, metadata jsonb, created_at                                                        | Row-level security; the app role has INSERT and SELECT only |
| `projects`        | id, tenant_id, name, owner_user_id, created_at                                                                                  | Row-level security                                          |

Each tenant table gets `ENABLE` and `FORCE ROW LEVEL SECURITY` and one policy for all commands, with `USING` and `WITH CHECK` both set to `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`. When the setting is missing, nothing matches.

`tenantTx(db, tenantId, fn)` opens a transaction, runs `select set_config('app.tenant_id', $1, true)`, then runs `fn(tx)`. Repositories for tenant tables only accept that `tx`.

## Auth guard

`TenantAuthGuard` is a global guard. Routes marked `@Public()` skip it. Routes marked `@SignedInOnly()` run steps 3–5 against the platform issuer and step 7, with no tenant. All other routes run every step:

1. Read the slug from the `Host` header (`<slug>.tenantry.localhost[:port]`). The apex host or an unknown, failed or deleted slug gives 404.
2. Load `tenant_identity` for the tenant.
3. Verify the bearer token's signature against the key set for that issuer. Keys are fetched from `TENANTRY_AUTH_INTERNAL_URL` (the container or loopback address), so the issuer string never has to resolve inside the API. A missing or invalid token gives 401.
4. Issuer rule: `iss` must equal the tenant's issuer exactly. Otherwise 401.
5. Audience: `aud` must include `tenantry-api`. Otherwise 401.
6. Roles: read only this tenant's organization block, matched by the organization alias (the slug). The group names `owners`, `admins` and `members` map to the roles `owner`, `admin` and `member`. With several, the highest wins. With none, the invite claimer runs (below). A token without this tenant's organization gives 403.
7. Upsert `(iss, sub)` in `identities` and return our user id. The first time, create the `users` row from the token's `email` and `name`.
8. Attach `TenantContext` (tenant id, user id, role, permissions). `@RequirePermission(p)` then gives 403 when `p` is missing.

No header, query parameter or body field can set the tenant. The exact claim shape of the organization group mapper is pinned by the first task of the plan, against the real server.

**Invite claimer:** the user is in the organization (they accepted the Keycloak invite) but in none of its groups. Inside `tenantTx` it looks for an open invite for the token's email. If one exists, it adds the user to that role's group through `IdentityDirectory`, sets `accepted_at`, writes `member.joined` to the audit log, and continues with that role. Otherwise 403. The role then applies from the next token; the current request uses it at once.

## Keycloak

Changes to `infra/keycloak/platform-realm.json`:

- `registrationAllowed: true`.
- Client `tenantry-web`: public, standard flow with PKCE (S256), redirect URIs `http://tenantry.localhost:*/*` and `http://*.tenantry.localhost:*/*` (the dev realm only; production templates come in Phase 6), web origins `+`.
- Client scope `tenantry-api-audience` with an audience mapper for `tenantry-api`, as a default scope of `tenantry-web`.
- The `organization` scope carries the Organization Group Membership mapper, so organization groups appear in the token.
- Confidential client `tenantry-backend` with a service account holding only the `realm-management` roles that organization management needs. Task 1 of the plan finds the smallest set that works and records it.
- Client `tenantry-isolation-tests`: confidential, direct access grants only, with the same audience scope. It exists only in this local dev realm file, so the test suite can get tokens for test users without a browser. Its secret is in `.env.example` as a local value.

The API gets `KEYCLOAK_BACKEND_CLIENT_ID` and `KEYCLOAK_BACKEND_CLIENT_SECRET`, validated at startup like the rest of its config.

## Flows

**Signup** (`POST /api/signup`, `@SignedInOnly`, body `{ name, slug }`):

Slug rule: `^[a-z][a-z0-9-]{1,30}[a-z0-9]$`, not one of `www, auth, mail, api, portal, app, admin, tenantry`. `GET /api/signup/slug-availability?slug=` answers `{ available, reason? }`.

The saga, each step recorded so a failure undoes what was done:

1. Insert the tenant with status `provisioning`. A taken slug gives 409.
2. Create the Keycloak organization (alias = slug, name = name).
3. Create its groups `owners`, `admins`, `members`.
4. Add the caller to the organization and to `owners`.
5. Insert `tenant_identity`, set status `active`, write `tenant.created` to the audit log, all in one transaction.

On any failure after step 1, delete what Keycloak created, set status `failed`, and answer 502 with a problem document. A slug whose tenant is `failed` can be signed up again: the old row is replaced.

The web app at the apex host signs the person in, shows the wizard, and on success sends them to `http://<slug>.tenantry.localhost`, which signs them in with `scope=openid organization:<slug>`. Keycloak's session makes that silent.

**Members** (all under a tenant host):

| Endpoint                          | Permission            | Does                                                                                                                                 |
| --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/members`                | `members:read`        | Members from Keycloak with their role, joined to our user ids (upserting identities), plus open invites                              |
| `POST /api/members/invites`       | `members:invite`      | `{ email, role }`. Calls Keycloak `invite-user`, stores the invite, writes `member.invited`. An open invite for that email gives 409 |
| `DELETE /api/members/invites/:id` | `members:invite`      | Revokes the invite, writes `invite.revoked`                                                                                          |
| `PATCH /api/members/:userId`      | `members:change-role` | `{ role }`. Moves the user between groups, writes `member.role_changed`                                                              |
| `DELETE /api/members/:userId`     | `members:remove`      | Removes the user from the organization, writes `member.removed`                                                                      |

Guards on these: only an owner can make or unmake an owner; the last owner cannot be demoted or removed (409); nobody can change their own role.

**Audit:** `AuditService.record(tx, ctx, action, target, metadata)` writes inside the caller's transaction. For a Keycloak change, the entry is written right after Keycloak succeeds. `GET /api/audit?before=<id>` (`audit:read`) returns 50 entries per page, newest first, with actor emails.

**Projects:** `GET /api/projects` (`projects:read`), `POST /api/projects` (`projects:write`, `{ name }`, writes `project.created`). Members get both permissions.

**Tenant info:** `GET /api/tenants/:slug/auth-config` is public and returns `{ issuer, clientId, organization }` for active tenants. `GET /api/me` returns the user, role and permissions; the web app shows or hides controls from it.

## Web app

- `lib/host.ts` decides from the hostname: the apex host shows the signup app, `<slug>.tenantry.localhost` shows the tenant app. Caddy gets a site block for the apex host.
- Tenant app start: `fetchAuthConfig(slug)`, then `AuthProvider` signs in with that organization scope. An unknown tenant shows a "Workspace not found" page.
- Pages, each from a `@tenantry/ui` pattern: Dashboard (exists), Members (ListPage, Invite and Change role in Carbon modals), Audit log (ListPage), Projects (ListPage, Create in a modal), Signup (WizardPage, two steps: details, then confirm).
- Navigation shows only what `GET /api/me` permits. A 403 from the API shows an inline error notification, never a blank page.
- The header gets a user menu with the email and "Sign out".

The ui-consistency checklists for these pages are written before the first UI task.

## Testing

| Layer     | Where             | Against                                                                                                                                 |
| --------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | next to the code  | Fakes: `InMemoryIdentityDirectory`, a local key set for tokens                                                                          |
| Database  | `packages/db`     | The compose Postgres, as `tenantry_app`. Row-level security and grants. Skipped with a clear message when `DATABASE_URL` is unreachable |
| Isolation | `tests/isolation` | The full running stack, through Caddy, with real Keycloak tokens from `tenantry-isolation-tests`                                        |

The isolation suite creates its own tenants and users with unique names per run, so it can run against a stack that already has data. It covers the seven Phase 1 rows of the README table.

CI gets a second job, `isolation`: copy `.env.example` to `.env`, `pnpm dev:stack`, `pnpm smoke`, `pnpm test:isolation`, and print the compose logs on failure.

## Documentation

- ADR-0017: code structure (feature modules behind interfaces).
- ADR-0018: signup through Keycloak first, with a compensating saga.
- ADR-0019: invites through Keycloak organization invites, role applied on first request.
- README: guarantees table rows for Phase 1 set to `tested`; a short "Try it" walkthrough.
- AGENTS.md: the module layout and the new lint rules.

## Risks

| Risk                                                           | Mitigation                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| The organization group claim shape differs from what we expect | Task 1 pins it with a test against the real server before the guard is written                |
| `tenantry-backend` needs broader admin roles than hoped        | Task 1 finds the smallest set; it is recorded in the ADR and the realm file                   |
| Keycloak invite emails need `verifyEmail` or a reachable SMTP  | Mailpit already receives the realm's mail; the isolation suite does not depend on email links |
| A saga step fails after Keycloak changed something             | Each step has an undo; a test with a failing fake covers every step                           |

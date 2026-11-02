# Tenantry Phase 1 (Standard tenant core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve signup, the Standard path of the auth guard, row-level security, members with invites and roles, an audit log and a projects example, proven by the seven Phase 1 isolation tests.

**Architecture:** The API is split into feature modules (`tenants`, `signup`, `members`, `audit`, `projects`) behind two interfaces: the repositories in `@tenantry/db` and `IdentityDirectory` in `@tenantry/keycloak-admin`. One global guard turns every request into a `TenantContext`. The web app gets one folder per feature and signs in through `@tenantry/oidc-client`.

**Spec deviation:** the spec names `react-router` 7; version 8.5.1 is current and is used instead (same data-mode API).

**Tech Stack:** NestJS 11, Drizzle 0.45 over `pg`, `jose` 6, Zod 4, Keycloak 26.8.1, React 19, `react-router` 8, `oidc-client-ts` 3, Carbon 1.119, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-02-tenantry-phase1-design.md`

## Global Constraints

- TypeScript strict, ESM, `.js` import specifiers; Conventional Commits; tests next to the code and written first (AGENTS.md).
- The tenant comes only from the `Host` header and the token. No header, query or body field sets it.
- Tenant tables are reached only through `tenantTx`. Only `packages/db` imports `pg` or `drizzle-orm/node-postgres`.
- Only `packages/keycloak-admin` calls Keycloak admin endpoints. Only `packages/oidc-client` imports `oidc-client-ts`.
- Code checks permissions, never role names. Every identity change writes an audit entry.
- Every API error is `application/problem+json` (RFC 9457) with `type`, `title`, `status`, `detail`.
- Slug rule: `^[a-z][a-z0-9-]{1,30}[a-z0-9]$`; reserved: `www, auth, mail, api, portal, app, admin, tenantry`.
- Keycloak claim shape: `organization: { "<alias>": { "groups": ["/owners"|"/admins"|"/members"] } }`; `groups: []` for a member with no group; no `organization` claim for a non-member.
- `tenantry-backend` realm-management roles: exactly `manage-realm`, `view-users`, `manage-users`, `manage-clients`.
- Group ↔ role: `owners` ↔ `owner`, `admins` ↔ `admin`, `members` ↔ `member`. Highest wins: owner > admin > member.
- UI: every screen starts from a `@tenantry/ui` pattern; Carbon components and tokens only; run `ui-consistency:finding-patterns` before the first UI task (Task 11) and `ui-consistency:verifying` after the last (Task 12).
- New env vars go in `.env.example` and the API's Zod config.

## Review Focus

1. Two concurrent signups for the same slug: exactly one wins, the other gets 409, and Keycloak holds one organization. (Test in Task 8.)
2. An email invited twice, or invited in a different case (`Bob@Example.com` vs `bob@example.com`): the second open invite gets 409. (Test in Task 3 and Task 9.)
3. A Host header with a port, uppercase letters or a trailing dot (`Acme.tenantry.localhost.:8080`) resolves to the same slug; `evil.com` or a nested `a.b.tenantry.localhost` gives 404. (Test in Task 6.)
4. A key rotation in Keycloak (an unknown `kid`) refetches the key set once instead of failing every request. (Test in Task 6.)
5. The last owner demoting themselves through a second owner who is then removed: the API refuses whichever step would leave no owner. (Test in Task 9.)

## File map

```
infra/keycloak/platform-realm.json        clients, mappers, registration          (Task 1)
infra/Caddyfile                           apex host site block                     (Task 1)
scripts/lib/realm.test.mjs                realm file assertions                    (Task 1)
packages/auth/src/roles.ts                projects perms, highestRole, group map   (Task 2)
packages/db/src/schema/*.ts               one file per table                       (Task 3)
packages/db/migrations/0001_phase1.sql    tables, RLS, grants                      (Task 3)
packages/db/src/tenant-tx.ts              tenantTx                                 (Task 3)
packages/db/src/repositories/*.ts         platform, invites, audit, projects       (Task 4)
packages/db/test-integration/*.itest.ts   RLS, grants, repositories vs Postgres    (Tasks 3–4)
packages/keycloak-admin/src/*             IdentityDirectory, http impl, fake       (Task 5)
apps/api/src/common/*                     problem filter, zod pipe                 (Task 6)
apps/api/src/auth/*                       guard and its parts                      (Task 6)
apps/api/src/modules/tenants|audit|projects|signup|members                         (Tasks 7–9)
packages/oidc-client/src/*                auth client, provider, hook              (Task 10)
apps/web/src/{router,lib,features}/*      routes and feature pages                 (Tasks 11–12)
tests/isolation/*                         the security suite                       (Task 13)
.github/workflows/ci.yml                  isolation job                            (Task 13)
docs/decisions/0017-0019, README, AGENTS  docs and lint rules                      (Task 14)
```

---

### Task 1: Keycloak realm, apex route and config

**Files:**

- Modify: `infra/keycloak/platform-realm.json`, `infra/Caddyfile`, `.env.example`, `infra/docker-compose.yml` (api env), `apps/api/src/config/config.ts`, `apps/api/src/config/config.test.ts`
- Create: `scripts/lib/realm.test.mjs`

**Interfaces:**

- Produces: config fields `baseDomain: string` (`TENANTRY_BASE_DOMAIN`, default `tenantry.localhost`), `publicPort: number | null` (from `TENANTRY_AUTH_URL`'s port, null for 80), `backendClientId: string`, `backendClientSecret: string` on `AppConfig`. Realm clients `tenantry-web`, `tenantry-backend`, `tenantry-isolation-tests`; client scope `tenantry-api-audience`. Env `TENANTRY_ISOLATION_CLIENT_SECRET`.

- [ ] **Step 1: Write the failing realm test** in `scripts/lib/realm.test.mjs` (node:test, reads the JSON):
  - `registrationAllowed === true`.
  - `tenantry-web`: `publicClient: true`, `standardFlowEnabled: true`, `directAccessGrantsEnabled: false`, attribute `pkce.code.challenge.method === 'S256'`, `redirectUris` deep-equals `['http://tenantry.localhost/*', 'http://tenantry.localhost:8080/*']`, `webOrigins` contains `'+'`, default scopes include `tenantry-api-audience`, optional scopes include `organization`, one protocol mapper with `protocolMapper === 'oidc-organization-group-membership-mapper'` and `config['access.token.claim'] === 'true'`.
  - `tenantry-api-audience` scope has an `oidc-audience-mapper` with `included.custom.audience === 'tenantry-api'` and `access.token.claim === 'true'`.
  - `tenantry-backend`: confidential, `serviceAccountsEnabled: true`, `standardFlowEnabled: false`, `directAccessGrantsEnabled: false`; the realm's `users` has `service-account-tenantry-backend` with `clientRoles['realm-management']` sorted equal to `['manage-clients','manage-realm','manage-users','view-users']`.
  - `tenantry-isolation-tests`: confidential, `directAccessGrantsEnabled: true`, `standardFlowEnabled: false`, same mapper and audience scope as `tenantry-web`.
  - Secrets of both confidential clients equal the values in `.env.example` (`KEYCLOAK_BACKEND_CLIENT_SECRET`, `TENANTRY_ISOLATION_CLIENT_SECRET`), parsed with `parseEnv` from `scripts/lib/env.mjs`.
- [ ] **Step 2: Run** `pnpm test:scripts` — Expected: the realm tests FAIL (clients missing).
- [ ] **Step 3: Edit the realm file** to satisfy the test. Use literal dev secrets (`dev-backend-secret`, `dev-isolation-secret`) matching `.env.example`. Add `clientScopes` only for `tenantry-api-audience`; do not redefine built-in scopes. Add to `.env.example`: `TENANTRY_BASE_DOMAIN=tenantry.localhost`, `KEYCLOAK_BACKEND_CLIENT_ID=tenantry-backend`, `KEYCLOAK_BACKEND_CLIENT_SECRET=dev-backend-secret`, `TENANTRY_ISOLATION_CLIENT_SECRET=dev-isolation-secret`. Pass the backend pair and base domain to the `api` service in compose.
- [ ] **Step 4: Add the apex site block** to `infra/Caddyfile`: `http://tenantry.localhost:{$TENANTRY_HTTP_PORT}` with the same `/api/*` and web handles as the tenant block.
- [ ] **Step 5: Config test first** in `config.test.ts`: `loadConfig` with the new vars returns `baseDomain`, `backendClientId`, `backendClientSecret`; `publicPort` is `8080` for `TENANTRY_AUTH_URL=http://auth.tenantry.localhost:8080` and `null` for `http://auth.tenantry.localhost`; a missing `KEYCLOAK_BACKEND_CLIENT_SECRET` throws `ConfigError` naming it. Run `pnpm --filter @tenantry/api test` → FAIL; implement in `config.ts`; run → PASS.
- [ ] **Step 6: Recreate Keycloak and check the stack.** The realm imports only into an empty Keycloak database, so run `pnpm stack:down` with volumes removed (`docker compose -f infra/docker-compose.yml --env-file .env down -v`), then `pnpm dev:stack && pnpm smoke`. Expected: 6/6 PASS. Then `curl -s -o /dev/null -w "%{http_code}" -H "Host: tenantry.localhost" http://127.0.0.1:$TENANTRY_HTTP_PORT/` → `200`.
- [ ] **Step 7: Run** `pnpm test:scripts && pnpm --filter @tenantry/api test` → PASS. **Commit:** `feat(infra): realm clients, audience and org group mappers, apex route`.

### Task 2: Roles, groups and permissions

**Files:** Modify `packages/auth/src/roles.ts`, `packages/auth/src/roles.test.ts`, `packages/auth/src/index.ts`.

**Interfaces:**

- Produces: `Permission` adds `'projects:read' | 'projects:write'` (all three roles get both). `type GroupName = 'owners' | 'admins' | 'members'`; `ROLES: readonly Role[] = ['owner','admin','member']`; `groupForRole(role: Role): GroupName`; `roleForGroupPath(path: string): Role | null` (accepts `/owners` or `owners`, anything else null); `highestRole(roles: readonly Role[]): Role | null`; `canAssignRole(actor: Role, from: Role | null, to: Role): boolean` (only an owner may assign `owner` or change an owner; admins may move between admin and member).

- [ ] **Step 1: Failing tests:** `permissionsFor(['member'])` has `projects:read` and `projects:write` but not `members:invite`; `roleForGroupPath('/admins') === 'admin'`, `roleForGroupPath('/admins/x') === null`, `roleForGroupPath('/other') === null`; `highestRole(['member','owner']) === 'owner'`, `highestRole([]) === null`; `canAssignRole('admin','member','admin') === true`, `canAssignRole('admin','member','owner') === false`, `canAssignRole('admin','owner','member') === false`, `canAssignRole('owner','admin','owner') === true`.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/auth test` → FAIL.
- [ ] **Step 3: Implement** in `roles.ts`; export from `index.ts`.
- [ ] **Step 4: Run** → PASS. **Commit:** `feat(auth): group-role mapping, highest role, role assignment rule, project permissions`.

### Task 3: Schema, migration, row-level security and tenantTx

**Files:**

- Create: `packages/db/src/schema/{tenants,tenant-identity,users,identities,tenant-invites,audit-log,projects,index}.ts`, `packages/db/migrations/0001_phase1.sql`, `packages/db/src/tenant-tx.ts`, `packages/db/src/db.ts`, `packages/db/vitest.integration.config.ts`, `packages/db/test-integration/{setup,rls}.itest.ts`
- Modify: `packages/db/migrations/meta/_journal.json`, `packages/db/src/index.ts`, `packages/db/package.json` (script `test:isolation`: `vitest run -c vitest.integration.config.ts`)

**Interfaces:**

- Produces: `type Db = NodePgDatabase<typeof schema>`; `createDb(pool: Pool): Db`; `type TenantTx` (a branded Drizzle transaction: `PgTransaction<...> & { readonly __tenant: string }`); `tenantTx<T>(db: Db, tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T>`; exported table objects `tenants, tenantIdentity, users, identities, tenantInvites, auditLog, projects`; `type TenantStatus = 'provisioning' | 'active' | 'failed'`.

- [ ] **Step 1: Write the schema files** matching the spec's table list exactly (columns, uuid defaults `gen_random_uuid()`, `timestamptz` with `defaultNow()`, `tenants.slug` unique, `identities` unique `(issuer, subject)`, `tenant_invites` partial unique index `(tenant_id, lower(email)) where accepted_at is null and revoked_at is null`, `role` columns typed as text with a check constraint `in ('owner','admin','member')`).
- [ ] **Step 2: Write the failing integration tests** `rls.itest.ts`, connecting with `DATABASE_URL` (app role) and `DATABASE_OWNER_URL` (owner, for setup only). `setup.itest.ts` runs `runMigrations` and fails the run with `"Postgres not reachable at <url>: start it with pnpm dev:infra"` when unreachable. Each test seeds two tenants with unique slugs.
  - `forgotten filter returns only the current tenant's rows`: inside `tenantTx(db, A)`, `tx.select().from(projects)` returns only A's project.
  - `no tenant set sees nothing`: a plain `db.select().from(projects)` returns `[]`.
  - `insert for another tenant is refused`: inside `tenantTx(db, A)`, inserting a project with `tenantId: B` rejects with a row-level security error (`/row-level security/`).
  - `app role cannot bypass`: as the app role, `set row_security = off` then select → rejects (`/row-level security/`); `alter table projects disable row level security` → rejects (`/must be owner/`); `set role tenantry_owner` → rejects (`/permission denied/`).
  - `audit log is append-only for the app role`: update and delete on `audit_log` inside `tenantTx` reject with `/permission denied/`.
  - `tenantTx clears the setting after the transaction`: after `tenantTx` returns, `select current_setting('app.tenant_id', true)` on the same pooled connection is `''` or null.
- [ ] **Step 3: Run** `pnpm --filter @tenantry/db test:isolation` with `pnpm dev:infra` up → FAIL (tables missing).
- [ ] **Step 4: Write `0001_phase1.sql`** by hand (statements separated by `--> statement-breakpoint`), add it to `_journal.json`. For each of `tenant_invites`, `audit_log`, `projects`: `enable` + `force row level security`, and one policy `tenant_isolation for all using (...) with check (...)` with `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`. `revoke update, delete on audit_log from tenantry_app`. Implement `tenantTx` with `select set_config('app.tenant_id', $1, true)` as the first statement of `db.transaction`.
- [ ] **Step 5: Run** the integration tests → PASS; `pnpm --filter @tenantry/db test` (unit) still PASS. **Commit:** `feat(db): phase 1 schema with forced row-level security and tenantTx`.

### Task 4: Repositories

**Files:** Create `packages/db/src/repositories/{platform,invites,audit,projects}.ts`, `packages/db/src/errors.ts`, `packages/db/test-integration/repositories.itest.ts`; modify `packages/db/src/index.ts`.

**Interfaces:**

- Consumes: Task 3's `Db`, `TenantTx`, `tenantTx`, tables.
- Produces:
  - `errors.ts`: `class SlugTakenError`, `class OpenInviteExistsError`.
  - `type Executor = Db | TenantTx`.
  - `TenantRecord = { id, slug, name, status: TenantStatus, realm: string | null, issuer: string | null, kcOrgId: string | null }`.
  - `platformRepository(ex: Executor)` → `{ findTenantBySlug(slug): Promise<TenantRecord | null>; findTenantById(id): Promise<TenantRecord | null>; insertProvisioningTenant(i: { slug; name }): Promise<{ id: string }>` (throws `SlugTakenError` when a `provisioning` or `active` tenant holds the slug; deletes a `failed` one first, in one statement-safe transaction)`; activateTenant(id, i: { realm; issuer; kcOrgId }): Promise<void>; markTenantFailed(id): Promise<void>; upsertIdentity(i: { issuer; subject; email: string | null; displayName: string | null }): Promise<{ userId: string }>; userIdsForSubjects(issuer, subjects: string[]): Promise<Map<string, string>>; subjectForUser(userId, issuer): Promise<string | null>; usersByIds(ids: string[]): Promise<Map<string, { email: string | null; displayName: string | null }>> }`.
  - `InviteRecord = { id, email, role: Role, invitedBy: string, createdAt: Date }`; `invitesRepository` functions taking `tx: TenantTx`: `createInvite(tx, i: { email; role; invitedBy }): Promise<InviteRecord>` (throws `OpenInviteExistsError` on the unique index), `listOpenInvites(tx)`, `findOpenInviteByEmail(tx, email)` (case-insensitive), `markInviteAccepted(tx, id)`, `revokeInvite(tx, id): Promise<boolean>`.
  - `AuditEntry = { id, actorUserId, action, target, metadata, createdAt }`; `insertAudit(tx, e: { actorUserId; action; target; metadata?: Record<string, unknown> }): Promise<void>`; `listAudit(tx, o: { before?: string; limit: number }): Promise<AuditEntry[]>` (newest first; `before` is an entry id).
  - `ProjectRecord = { id, name, ownerUserId, createdAt }`; `listProjects(tx)`, `getProject(tx, id): Promise<ProjectRecord | null>`, `createProject(tx, i: { name; ownerUserId }): Promise<ProjectRecord>`.
  - Each tenant repository gets `tenantId` from the setting in the database (`insert ... values (nullif(current_setting('app.tenant_id', true), '')::uuid, ...)`) — never from a parameter.
- [ ] **Step 1: Failing tests** in `repositories.itest.ts`:
  - `insertProvisioningTenant` twice with the same slug → second throws `SlugTakenError`; after `markTenantFailed`, a third succeeds with a new id.
  - Two concurrent `insertProvisioningTenant` calls for one new slug → exactly one fulfils, one rejects with `SlugTakenError` (`Promise.allSettled`).
  - `upsertIdentity` twice for the same `(issuer, subject)` → same `userId`; a different issuer → different `userId`.
  - `createInvite` for `bob@example.com` then `Bob@Example.com` → second throws `OpenInviteExistsError`; after `revokeInvite`, creating again succeeds.
  - `findOpenInviteByEmail(tx, 'BOB@example.com')` finds the open invite.
  - `getProject` inside tenant A's tx for B's project id → `null`.
  - `listAudit` with `limit: 2` returns the two newest; with `before: <second id>` returns the next one.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/db test:isolation` → FAIL.
- [ ] **Step 3: Implement** the four repositories and errors; map Postgres `23505` to the typed errors.
- [ ] **Step 4: Run** → PASS. **Commit:** `feat(db): platform, invite, audit and project repositories`.

### Task 5: IdentityDirectory

**Files:** Create `packages/keycloak-admin/src/{identity-directory.ts,http-identity-directory.ts,admin-token.ts,errors.ts,index.ts}`, `packages/keycloak-admin/src/testing/in-memory-identity-directory.ts`, `packages/keycloak-admin/src/contract.ts` (shared contract), `packages/keycloak-admin/src/in-memory.test.ts`, `packages/keycloak-admin/test-integration/http.itest.ts`, configs and `package.json` (`exports`: `.` and `./testing`; scripts `test`, `test:isolation`).

**Interfaces:**

- Produces:

```ts
export type GroupName = 'owners' | 'admins' | 'members'; // re-exported from @tenantry/auth
export interface DirectoryMember { kcUserId: string; email: string | null; displayName: string | null; group: GroupName | null }
export interface IdentityDirectory {
  createOrganization(i: { alias: string; name: string }): Promise<{ id: string }>;
  deleteOrganization(orgId: string): Promise<void>;             // 404 is success
  createGroups(orgId: string): Promise<void>;                   // owners, admins, members
  addMember(orgId: string, kcUserId: string): Promise<void>;
  removeMember(orgId: string, kcUserId: string): Promise<void>;
  setMemberGroup(orgId: string, kcUserId: string, group: GroupName): Promise<void>; // leaves the other two
  listMembers(orgId: string): Promise<DirectoryMember[]>;
  inviteUser(orgId: string, email: string): Promise<void>;
  addTenantOrigin(origin: string): Promise<void>;               // tenantry-web redirectUris `${origin}/*` + webOrigins; idempotent
  removeTenantOrigin(origin: string): Promise<void>;
}
export class DirectoryError extends Error { constructor(op: string, status: number) }
export function createHttpIdentityDirectory(o: { baseUrl: string; realm: string; clientId: string; clientSecret: string; webClientId: string; fetch?: typeof fetch }): IdentityDirectory;
// testing entry:
export class InMemoryIdentityDirectory implements IdentityDirectory { failOn(op: keyof IdentityDirectory): void; readonly origins: ReadonlySet<string>; orgs: Map<...> }
```

- Keycloak endpoints (verified against 26.8.1): `POST organizations`; `POST organizations/{id}/groups` `{name}`; `POST organizations/{id}/members` with the user id as a JSON string body; `DELETE organizations/{id}/members/{uid}`; `GET organizations/{id}/members`; `GET organizations/{id}/members/{uid}/groups`; `PUT|DELETE organizations/{id}/groups/{gid}/members/{uid}`; `GET organizations/{id}/groups`; `POST organizations/{id}/members/invite-user` form `email`; clients via `GET clients?clientId=` and `PUT clients/{id}`. The admin token comes from the client-credentials grant and is cached until 30 s before expiry.
- [ ] **Step 1: Write `contract.ts`**, `runIdentityDirectoryContract(name, make: () => Promise<{ dir; newUser(): Promise<string>; cleanup(): Promise<void> }>)` with cases: create org + groups then `listMembers` is `[]`; `addMember` then `listMembers` shows the user with `group: null`; `setMemberGroup(…,'admins')` then `'members'` → listed group `members` only; `removeMember` → gone; `deleteOrganization` twice → no throw; `addTenantOrigin('http://x-<rand>.tenantry.localhost:8080')` twice then `removeTenantOrigin` → no throw.
- [ ] **Step 2:** `in-memory.test.ts` runs the contract against `InMemoryIdentityDirectory`, plus `failOn('createGroups')` makes `createGroups` reject with `DirectoryError`. `http.itest.ts` runs it against Keycloak with `tenantry-backend` credentials from `.env`, creating test users through the bootstrap admin. Run both → FAIL.
- [ ] **Step 3: Implement** the fake and the HTTP client.
- [ ] **Step 4: Run** `pnpm --filter @tenantry/keycloak-admin test` and `test:isolation` → PASS. **Commit:** `feat(keycloak-admin): IdentityDirectory with HTTP implementation and in-memory fake`.

### Task 6: API foundations and the auth guard

**Files:**

- Create: `apps/api/src/common/{problem.filter.ts,problem.filter.test.ts,zod.pipe.ts,zod.pipe.test.ts,http-errors.ts}`, `apps/api/src/auth/{host.ts,host.test.ts,token-verifier.ts,token-verifier.test.ts,role-claims.ts,role-claims.test.ts,invite-claimer.ts,invite-claimer.test.ts,tenant-auth.guard.ts,tenant-auth.guard.test.ts,decorators.ts,request-context.ts,auth.module.ts}`, `apps/api/src/infrastructure/{db.provider.ts,directory.provider.ts}`, `apps/api/src/testing/{tokens.ts,test-app.ts}`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/package.json` (add `jose`, `@tenantry/auth`, `@tenantry/keycloak-admin`)

**Interfaces:**

- Consumes: Task 1 config, Task 2 roles, Task 4 repositories, Task 5 `IdentityDirectory`.
- Produces:
  - DI tokens `DB` (`Db`), `IDENTITY_DIRECTORY` (`IdentityDirectory`), provided in `app.module.ts` from config. The HTTP directory is created only in `directory.provider.ts`.
  - `slugFromHost(host: string | undefined, baseDomain: string): string | null` (lowercases, drops the port and one trailing dot; returns the single label left of `.<baseDomain>`; null for the apex, other domains and nested labels).
  - `createTokenVerifier(o: { jwksUrl: URL; issuer: string; audience: string }): (token: string) => Promise<JWTPayload>` using `createRemoteJWKSet` (it refetches on an unknown `kid`); throws `UnauthorizedProblem`.
  - `rolesFromClaims(payload: JWTPayload, alias: string): { member: false } | { member: true; roles: Role[] }`.
  - `InviteClaimer.claim(i: { tenant: TenantRecord; userId: string; kcUserId: string; email: string | null }): Promise<Role | null>`.
  - Request augmentation in `request-context.ts`: `req.tenantContext?: TenantContext`, `req.tenant?: TenantRecord`, `req.signedIn?: { userId: string; kcUserId: string; email: string | null; issuer: string }`.
  - Decorators: `@Public()`, `@SignedInOnly()`, `@RequirePermission(p: Permission)`, param decorators `@Ctx()`, `@CurrentTenant()`, `@SignedIn()`.
  - Problem classes in `http-errors.ts`: `NotFoundProblem`, `UnauthorizedProblem`, `ForbiddenProblem`, `ConflictProblem`, `BadGatewayProblem`, `ValidationProblem` (all extend one `Problem` with `status`, `title`, `detail`, `type` = `https://tenantry.dev/problems/<kebab-title>`).
  - Testing helpers: `testing/tokens.ts` `makeTestIssuer()` returns `{ issuer, jwksUrl, sign(claims): Promise<string> }` backed by a local key pair and a local HTTP server serving the key set; `testing/test-app.ts` `createTestApp(overrides)` builds the Nest app with `InMemoryIdentityDirectory` and the integration Postgres.
- [ ] **Step 1: Failing unit tests:**
  - `host.test.ts`: `slugFromHost('acme.tenantry.localhost:8080','tenantry.localhost') === 'acme'`; `'ACME.tenantry.localhost.'` → `'acme'`; `'tenantry.localhost'` → null; `'a.b.tenantry.localhost'` → null; `'evil.com'` → null; `undefined` → null.
  - `role-claims.test.ts`: `{ organization: { acme: { groups: ['/admins'] } } }` with alias `acme` → member, `['admin']`; with alias `other` → not a member; `{ groups: [] }` → member, `[]`; no `organization` claim → not a member; `realm_access: { roles: ['owner'] }` alone → not a member; groups `['/owners','/members']` → `['owner','member']`.
  - `token-verifier.test.ts` (with `makeTestIssuer`): a valid token passes; wrong `iss` → `UnauthorizedProblem`; `aud: 'account'` → `UnauthorizedProblem`; expired → `UnauthorizedProblem`; after the issuer rotates its key, a token signed with the new key passes (one refetch).
  - `problem.filter.test.ts`: a thrown `ConflictProblem('Slug taken')` → status 409, content type `application/problem+json`, body `{ type, title: 'Conflict', status: 409, detail: 'Slug taken' }`; an unknown `Error` → 500 with `detail` that does not contain the error message.
  - `zod.pipe.test.ts`: invalid input → `ValidationProblem` (422) listing field paths.
  - `invite-claimer.test.ts` (integration Postgres, in-memory directory): an open invite for `bob@example.com` as `admin` → returns `'admin'`, the directory shows Bob in `admins`, the invite is accepted, an audit row `member.joined` exists; no invite → null and nothing written.
  - `tenant-auth.guard.test.ts` via `createTestApp` and a probe controller with `@RequirePermission('members:invite')`: unknown slug → 404; no token → 401; token from another issuer → 401; token without this tenant's organization → 403; member token → 403; admin token → 200 and the controller sees `tenantContext.tenantId` of the host's tenant; a request with header `X-Tenant-Id: <other tenant id>` still sees the host's tenant; `@Public` route → 200 without token; `@SignedInOnly` route with a platform token and the apex host → 200 with `signedIn.userId` set.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/api test` → FAIL.
- [ ] **Step 3: Implement.** The guard runs the spec's eight steps in order; the JWKS URL is `${authInternalUrl}/realms/platform/protocol/openid-connect/certs`; the issuer is `${authUrl}/realms/platform`. Register the guard with `APP_GUARD` and the filter with `APP_FILTER`. Mark the health controller `@Public()`.
- [ ] **Step 4: Run** → PASS; `pnpm --filter @tenantry/api lint typecheck` → clean. **Commit:** `feat(api): tenant auth guard, problem responses, request validation`.

### Task 7: Tenants, audit and projects modules

**Files:** Create `apps/api/src/modules/tenants/*`, `apps/api/src/modules/audit/*`, `apps/api/src/modules/projects/*` (module, controller, service, schemas, tests each).

**Interfaces:**

- Consumes: Task 6 decorators, providers and test app; Task 4 repositories.
- Produces: `AuditService.record(tx: TenantTx, ctx: { userId: string }, action: AuditAction, target: string, metadata?: Record<string, unknown>): Promise<void>` with `type AuditAction = 'tenant.created' | 'member.invited' | 'invite.revoked' | 'member.joined' | 'member.role_changed' | 'member.removed' | 'project.created'`. Endpoints exactly as the spec's "Tenant info", "Audit" and "Projects" paragraphs. `GET /api/me` → `{ user: { id, email, displayName }, tenant: { slug, name }, role, permissions: Permission[] }`. Audit list items: `{ id, action, target, metadata, createdAt, actor: { id, email } }`, and `nextBefore: string | null`.
- [ ] **Step 1: Failing tests** (`createTestApp`):
  - `GET /api/tenants/acme/auth-config` → 200 `{ issuer, clientId: 'tenantry-web', organization: 'acme' }`; for a `failed` tenant → 404; no auth needed.
  - `GET /api/me` as an admin → `role: 'admin'`, `permissions` contains `members:invite`, not `tenant:settings`.
  - Projects: `POST /api/projects { name: 'Apollo' }` as a member → 201 and an audit row `project.created`; `GET /api/projects` on tenant B's host does not list it; `GET /api/projects/<A's id>` on B's host with a B token → 404; `POST` with `name: ''` → 422; a name of 121 characters → 422 (max 120).
  - Audit: as a member → 403; as an admin → 200 with entries newest first; `?before=<id>` pages.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. **Commit:** `feat(api): tenants, audit and projects modules`.

### Task 8: Signup

**Files:** Create `apps/api/src/modules/signup/{signup.module.ts,signup.controller.ts,signup.service.ts,signup.saga.ts,slug.ts,signup.schemas.ts}` with tests.

**Interfaces:**

- Consumes: Tasks 4–7.
- Produces: `validateSlug(slug: string): { ok: true } | { ok: false; reason: 'format' | 'reserved' }`; `GET /api/signup/slug-availability?slug=` → `{ available: boolean; reason?: 'format' | 'reserved' | 'taken' }`; `POST /api/signup { name, slug }` → 201 `{ slug, url }` where `url` is `http://<slug>.<baseDomain>` plus `:<publicPort>` when set. `tenantOrigin(slug, config): string` in `slug.ts`, used for both the URL and `addTenantOrigin`.
- [ ] **Step 1: Failing tests:**
  - `slug.test.ts`: `'acme'` ok; `'a'`, `'-acme'`, `'acme-'`, `'Acme'`, 33 characters → `format`; `'admin'` → `reserved`.
  - `signup.service.test.ts` (in-memory directory, integration Postgres): success → tenant `active`, org with the three groups, the caller in `owners`, origin registered, `tenant_identity` row with issuer `${authUrl}/realms/platform`, audit `tenant.created`; for each of `createOrganization`, `createGroups`, `addMember`, `setMemberGroup`, `addTenantOrigin` made to fail with `failOn`: response 502, tenant `failed`, no organization left in the fake, no origin left; then signing up with the same slug again succeeds; a taken active slug → 409; two concurrent signups for one slug → one 201 and one 409, and the fake holds one organization.
  - Controller: apex host only (`POST /api/signup` on a tenant host → 404); `name` 1–80 characters; missing token → 401.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the saga as an ordered list of `{ run, undo }` steps executed in `signup.saga.ts`; undo runs in reverse for completed steps and logs (does not throw) when an undo fails. **Step 4: Run** → PASS. **Commit:** `feat(api): self-serve signup with compensating saga`.

### Task 9: Members

**Files:** Create `apps/api/src/modules/members/{members.module.ts,members.controller.ts,members.service.ts,members.schemas.ts}` with tests.

**Interfaces:**

- Consumes: Tasks 2, 4–7.
- Produces: `GET /api/members` → `{ members: Array<{ userId, email, displayName, role: Role | null }>, invites: Array<{ id, email, role, createdAt }> }`; the other four endpoints as in the spec's Members table; error rules: 404 when `userId` is not a member of this tenant, 409 for last owner, 403 for self-change or a forbidden `canAssignRole`.
- [ ] **Step 1: Failing tests** (`createTestApp`, in-memory directory):
  - List as a member → 200, members joined to our user ids, open invites included.
  - Invite as an admin → 201, invite stored, the fake recorded `inviteUser`, audit `member.invited`; invite as a member → 403; `Bob@Example.com` after `bob@example.com` → 409; role `owner` invited by an admin → 403.
  - Revoke → 204 and audit `invite.revoked`; unknown id → 404.
  - Change role: admin moves a member to admin → 200, audit `member.role_changed` with `{ from, to }`; admin changing an owner → 403; anyone changing themselves → 403; demoting the only owner → 409; with two owners, removing one → 204, then demoting the remaining one → 409.
  - Remove: as an admin → 204, gone from the fake, audit `member.removed`; removing the last owner → 409; a userId from tenant B → 404.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Owner counting reads `listMembers` from the directory at the moment of the change. **Step 4: Run** → PASS. **Commit:** `feat(api): members, invites and role changes`.

### Task 10: oidc-client

**Files:** Create `packages/oidc-client/src/{auth-config.ts,auth-client.ts,AuthProvider.tsx,index.ts}` with tests; add `oidc-client-ts@^3.5.0`, React peer, Vitest jsdom config.

**Interfaces:**

- Produces: `type AuthConfig = { issuer: string; clientId: string; organization: string | null }`; `fetchAuthConfig(slug: string, fetchFn?: typeof fetch): Promise<AuthConfig | null>` (null on 404); `createAuthClient(c: AuthConfig & { redirectUri: string }): AuthClient` with `{ signIn(): Promise<void>; handleCallback(): Promise<void>; getAccessToken(): Promise<string | null>; signOut(): Promise<void>; user(): Promise<{ email: string | null; name: string | null } | null> }`, scope `openid organization:<organization>` or `openid` when null, PKCE S256, session storage; `<AuthProvider client>` handles the callback URL `/auth/callback`, signs in when there is no user, and renders children once signed in; `useAuth(): { user; getAccessToken; signOut }`.
- [ ] **Step 1: Failing tests:** `fetchAuthConfig` returns null on 404 and the parsed body on 200; `createAuthClient` builds a `UserManager` with `scope: 'openid organization:acme'` (inspect `settings`); the provider renders a loading state, then children once `user()` resolves.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS. **Commit:** `feat(oidc-client): PKCE auth client and React provider`.

### Task 11: Web routing, auth wiring and signup

**Before this task:** run `ui-consistency:finding-patterns` for the signup wizard and the three list pages; record its checklist in the ledger.

**Files:** Create `apps/web/src/router.tsx`, `apps/web/src/lib/{host.ts,api.ts}` with tests, `apps/web/src/features/signup/*`, `apps/web/src/features/not-found/*`; move `routes/DashboardRoute.tsx` → `features/dashboard/`, `routes/PatternsRoute.tsx` → `features/patterns/`; modify `apps/web/src/main.tsx`, `App.tsx` (removed or reduced to the router), `packages/ui/src/shell/AppShell.tsx` (`renderLink`), `apps/web/package.json` (`react-router@^8.5.1`, `@tenantry/oidc-client`).

**Interfaces:**

- The base domain comes from `import.meta.env.VITE_TENANTRY_BASE_DOMAIN`, default `tenantry.localhost`.
- Produces: `hostKind(hostname: string, baseDomain: string): { kind: 'apex' } | { kind: 'tenant'; slug: string } | { kind: 'unknown' }`; `createApi(getToken: () => Promise<string | null>)` → `{ get<T>(path): Promise<T>; post<T>(path, body): Promise<T>; patch<T>(path, body): Promise<T>; del(path): Promise<void> }` throwing `ApiProblem { status; title; detail }`; `AppShell` prop `renderLink?: (p: { href: string; className?: string; children: ReactNode; isActive: boolean }) => ReactNode`.
- [ ] **Step 1: Failing tests:** `hostKind` cases mirroring Task 6's host test; `createApi` adds `Authorization: Bearer <t>` and turns a problem response into `ApiProblem` with its `detail`; `AppShell` with `renderLink` renders the custom link; the signup wizard: typing a taken slug shows "This address is taken"; a reserved slug shows "This address is reserved"; submitting calls `POST /api/signup` and navigates to the returned `url`; a 502 shows an inline error notification and keeps the form.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS. Check the apex page and the wizard in the browser at phone width and in both themes. **Commit:** `feat(web): router, host-aware auth and the signup wizard`.

### Task 12: Members, audit and projects pages

**Files:** Create `apps/web/src/features/{members,audit,projects}/*` with tests; modify `router.tsx` and the shell's nav items (built from `GET /api/me` permissions); add a header user menu with the email and "Sign out".

**Interfaces:** Consumes Task 7–9 endpoints and Task 11's `createApi`, `renderLink`.

- [ ] **Step 1: Failing tests** (API mocked at `createApi`): the members page lists members and pending invites; the Invite button is absent without `members:invite`; inviting adds a pending row; a 409 shows "This person already has an open invite"; changing a role calls `PATCH`; the last-owner 409 shows its `detail`; the audit page shows actions newest first and loads the next page; the projects page creates a project; nav hides Members' actions and Audit for a member; any 403 renders an inline error notification.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS. **Step 5:** run `ui-consistency:verifying` with a separate checker against Task 11's checklist; fix what it reports. Check light, dark and phone width in the browser. **Commit:** `feat(web): members, audit log and projects pages`.

### Task 13: Isolation suite and CI

**Files:** Create `tests/isolation/{package.json,tsconfig.json,vitest.config.ts,src/helpers/{http.ts,keycloak.ts,tenants.ts},src/phase1.test.ts}`; modify `pnpm-workspace.yaml` (add `tests/*`), root `package.json` (`test:isolation`: `turbo run test:isolation`), `turbo.json` (`test:isolation` with `dependsOn: ["^build"]`, `cache: false`), `.github/workflows/ci.yml`.

**Interfaces:**

- Produces: helpers `api(host: string, method, path, o?: { token?; body?; headers? })` (node:http to `127.0.0.1:<TENANTRY_HTTP_PORT>` with a `Host` header); `createUser(email): Promise<{ kcUserId; email; password }>` through the bootstrap admin; `tokenFor(user, slug?)` via `tenantry-isolation-tests` with scope `openid organization:<slug>`; `signupTenant(owner, slug)` through `POST /api/signup`; `addToTenant(user, slug, role)` through the admin API (organization member + group).
- [ ] **Step 1: Write `phase1.test.ts`** with one `describe` per README row, unique slugs per run:
  1. A's owner asks for B's project id on A's host → 404.
  2. A's token on B's host for `GET /api/projects` → 403.
  3. (Database row; runs in `packages/db` `rls.itest.ts`.) Here: listing projects on A's host returns none of B's.
  4. (Database row; `rls.itest.ts`.)
  5. A user who is admin in A and member in B: on B's host with a B-scoped token, `POST /api/members/invites` → 403; with the A-scoped token on B's host → 403.
  6. `X-Tenant-Id: <B's id>` on A's host → A's projects only.
  7. A member's invite, remove and change-role calls → 403 each.
- [ ] **Step 2:** with the stack running (`pnpm dev:stack`), run `pnpm test:isolation` → PASS for `tests/isolation`, `packages/db` and `packages/keycloak-admin`.
- [ ] **Step 3: CI job** `isolation` in `ci.yml`: checkout, pnpm, node 22, `pnpm install --frozen-lockfile`, `cp .env.example .env`, `pnpm build`, `pnpm dev:stack`, `pnpm smoke`, `pnpm test:isolation`, and `if: failure()` → `docker compose -f infra/docker-compose.yml --env-file .env logs --no-color`.
- [ ] **Step 4: Commit:** `test(isolation): phase 1 security suite against the running stack, in CI`.

### Task 14: Lint rules and docs

**Files:** Modify `eslint.config.mjs`, `README.md`, `AGENTS.md`; create `docs/decisions/0017-feature-modules.md`, `0018-signup-saga.md`, `0019-keycloak-org-invites.md`, update `docs/decisions/README.md`; create `scripts/lib/lint-rules.test.mjs`.

- [ ] **Step 1: Failing test** `lint-rules.test.mjs`: runs ESLint's Node API on in-memory snippets and expects an error for each: `import { UserManager } from 'oidc-client-ts'` in `apps/web/src/x.ts`; `import { createHttpIdentityDirectory } from '@tenantry/keycloak-admin'` in `apps/api/src/modules/members/x.ts`; `import { MembersService } from '../members/members.service.js'` in `apps/api/src/modules/audit/x.ts`; and no error for the same keycloak import in `apps/api/src/infrastructure/directory.provider.ts`.
- [ ] **Step 2:** run `pnpm test:scripts` → FAIL. **Step 3:** add the rules. **Step 4:** run → PASS; `pnpm lint` clean.
- [ ] **Step 5: Docs:** the three ADRs (context, decision, consequences, with the pinned role set and the redirect-URI decision in 0018); README guarantees rows 1–7 set to `tested` with row 1's expected result changed to 404 (as the spec says) and a "Try it" walkthrough (signup at `http://tenantry.localhost`, invite, Mailpit); AGENTS.md module layout and new rules.
- [ ] **Step 6:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → PASS. **Commit:** `docs: phase 1 ADRs, guarantees and agent rules; lint module boundaries`.

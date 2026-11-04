# Phase 5b (Standard → Enterprise migration, scoped console access) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator moves a Standard workspace into a realm of its own, keeping every Tenantry user id and all its data, and enterprise owners give chosen admins people-and-groups access to their realm's Keycloak console.

**Architecture:**

- **The move.** It runs as operator API endpoints in `EnterpriseService`'s module, driven by `pnpm ops enterprise migrate`. Each step checks Keycloak and `tenant_migrations` before acting, so a rerun finishes the move.
- **Keycloak code.** New `packages/keycloak-admin` pieces (`RealmConsole`, `RealmBridge`, `RealmIdps`, and additions to `IdentityDirectory` and `RealmMembers`) do all the Keycloak work, each with an in-memory fake and a contract test run against real Keycloak.
- **Console access** is a members-module feature. It writes our row, the realm group and the owner deny list in one request.

**Tech Stack:** NestJS, Drizzle and Postgres with RLS, Keycloak 26.8.1 Admin API with fine-grained admin permissions v2, React with Carbon, and Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-tenantry-phase5b-design.md`

## Global Constraints

- Keycloak 26.8.1; template version becomes 4 (`TEMPLATE_VERSION = 4`).
- Realm name `ent-<slug>`; bridge provider alias `tenantry-account`, display name "Continue with your Tenantry account"; platform bridge client `tenantry-bridge-<slug>`; deny flow `tenantry-bridge-first-login` (one execution, provider `deny-access-authenticator`, REQUIRED).
- Secrets only in the secrets store: bridge secret `ent-<slug>/tenantry-bridge`; company-login secret `platform/idp-<alias>` (keys are `<realm>/<name>` with no second slash — ruling against the spec's `platform/idp/<alias>`).
- Console group `tenantry-console`; console realm-management roles `query-users`, `query-groups`; console URL `<authUrl>/admin/<realm>/console/`.
- Console permissions (FGAP v2, on the realm's `admin-permissions` client): policy "console users" (group `tenantry-console`, POSITIVE), policy "not console users" (same group, NEGATIVE); permission "console users: users" (Users, all, `view manage reset-password manage-group-membership`); "console users: not owners" (Users, resources = owner ids, `manage reset-password manage-group-membership impersonate map-roles`, negative policy); "console users: groups" (Groups, all, `view view-members manage-membership`); "console users: not the console group" (Groups, resource `tenantry-console`, `manage manage-membership manage-members`, negative policy).
- Status values `provisioning | active | failed | migrating`.
- Freeze message (409): "This workspace is moving to Enterprise. Try again in a few minutes."
- Standard console message (404): "Console access is available on Enterprise workspaces."
- Audit actions added: `tenant.migrating`, `tenant.migrated`, `tenant.migration_finished`, `tenant.migration_aborted`, `console.granted`, `console.revoked`, `idp.secret_set`. Metadata carries counts, aliases and ids, never secrets or people's attributes.
- No attribution lines in commits or PR text. Conventional Commits. Tests first. Secrets never in Postgres, logs or audit.

## Review Focus

1. A person who is in two Standard workspaces is moved with one of them → their shared-realm account and identity row still work for the other (Task 6 test `keeps the shared-realm identity for other workspaces`).
2. An organization member with no group (joined through company login) → moved with no role, still pre-linked to the bridge and their company login (Task 6 test `moves a member with no role`).
3. A move that fails after copying some people and is run again → no second Keycloak user, no second identity row, everyone present once (Task 6 test `rerun after a failure part-way through people`).
4. An owner made admin, or removed, in Tenantry → leaves the owner deny list in the same request, so console users can then manage them; an admin made owner joins it (Task 5 test `owner deny list follows role changes`).
5. A member's email differs only in case from an account already in the new realm (`Alice@Globex.test` vs `alice@globex.test`) → that account is reused, not duplicated (Task 3 contract `importMember reuses an account by email, ignoring case`).

---

### Task 1: Database — migration record, console access, the `migrating` status

**Files:**

- Create: `packages/db/migrations/0005_phase5b.sql` (+ journal idx 5), `packages/db/src/schema/tenant-migrations.ts`, `packages/db/src/schema/tenant-console-access.ts`, `packages/db/src/repositories/migrations.ts`, `packages/db/src/repositories/console-access.ts`
- Modify: `packages/db/src/schema/tenants.ts` (`TenantStatus` adds `'migrating'`; check constraint), `packages/db/src/schema/index.ts`, `packages/db/src/index.ts`, platform repository (`setTenantStatus(id, status)` if missing; `cutOverToEnterprise(id, { realm, issuer, templateVersion })` sets tier, status `active`, `tenant_identity` realm/issuer/version and `kc_org_id` null in one statement set)
- Test: `packages/db/test-integration/phase5b.itest.ts`

**Interfaces — Produces:**

- `MigrationRecord { fromOrgId: string; realm: string; startedAt: Date; cutOverAt: Date | null; finishedAt: Date | null; abortedAt: Date | null }`
- `getMigration(tx): Promise<MigrationRecord | null>`, `startMigration(tx, { fromOrgId, realm }): Promise<MigrationRecord>` (idempotent: returns the open one), `markCutOver(tx)`, `markFinished(tx)`, `markAborted(tx)`.
- `grantConsole(tx, { userId, grantedBy }): Promise<boolean>` (false if already), `revokeConsole(tx, userId): Promise<boolean>`, `listConsole(tx): Promise<string[]>` (user ids).
- `platformRepository(db).cutOverToEnterprise(tenantId, { realm, issuer, templateVersion }): Promise<void>`

- [ ] **Step 1:** itests: both tables are invisible across tenants (forced RLS, as in `phase5a.itest.ts`); `startMigration` twice returns the same row; `markCutOver` sets `cutOverAt`; `grantConsole` twice → `true` then `false`; `revokeConsole` removes; tenant status accepts `migrating` and rejects `moving`; `cutOverToEnterprise` makes tier `enterprise`, status `active`, `kc_org_id` null and the new issuer.
- [ ] **Step 2:** run `pnpm --filter @tenantry/db test:isolation` — FAIL (no tables).
- [ ] **Step 3:** write the migration, schemas and repositories.
- [ ] **Step 4:** run again — PASS.
- [ ] **Step 5:** commit `feat(db): migration record and console access`.

### Task 2: Template v4 and `RealmConsole`

**Files:**

- Create: `packages/keycloak-admin/templates/enterprise-realm.v4.json` (v3 + `templateVersion` 4, `adminPermissionsEnabled: true`, `adminEventsEnabled: true`, `adminEventsDetailsEnabled: true`), `packages/keycloak-admin/src/realms/console.ts`, `src/testing/in-memory-realm-console.ts`, `src/testing/console-contract.ts`, `test-integration/realm-console.itest.ts`
- Modify: `templates.ts` (`TEMPLATE_VERSION = 4`; `MAPPED_GROUPS` unchanged; add `CONSOLE_GROUP = 'tenantry-console'`), `RealmProvisioner.ensureGroups` also makes `tenantry-console` (no role mapping), `scripts/lib/realm.test.mjs` reads v4, `src/index.ts`, `src/testing/index.ts`, `in-memory.test.ts`.

**Interfaces — Produces:**

```ts
export interface RealmConsole {
  ensurePermissions(): Promise<void>; // the two policies and four permissions; idempotent
  grant(kcUserId: string): Promise<void>; // into tenantry-console + query-users, query-groups
  revoke(kcUserId: string): Promise<void>; // the reverse; a missing user is not an error
  protectOwners(ownerIds: string[]): Promise<void>; // replaces the deny permission's resources
  consoleUrl(): string; // `${publicAuthUrl}/admin/${realm}/console/`
}
export function createRealmConsole(o: {
  baseUrl: string;
  publicAuthUrl: string;
  realm: string;
  provisionerClientId: string;
  provisionerClientSecret: string;
  fetch?: typeof fetch;
}): RealmConsole;
```

Fake `InMemoryRealmConsole`: `members: Set<string>`, `owners: string[]`, `permissionsEnsured: number`, `failNext(status)`.

- [ ] **Step 1:** contract `runRealmConsoleContract` with subject `{ console, createUser(): Promise<string>, tokenFor(kcUserId): Promise<string> /* console client, as the probe */, adminCall(token, method, path, body?): Promise<number> }`:
  - `a console user may edit and reset a member, and add them to tenantry-admins` (204s)
  - `a console user may not edit, reset or delete an owner` (403s), `may view an owner` (200)
  - `may not add anyone to tenantry-console, map roles, impersonate, or open clients, the realm or identity providers` (403s)
  - `protectOwners replaces the list` (an owner dropped from the list can then be edited)
  - `revoke takes access away at the next token` (401/403)
  - `the console starts: whoami 200 with a security-admin-console token`
    The fake runs a reduced contract (membership and owner list bookkeeping); the full one runs in `realm-console.itest.ts` against a provisioned test realm.
- [ ] **Step 2:** run both — FAIL.
- [ ] **Step 3:** implement (admin-permissions client found by `clientId=admin-permissions`; policies and permissions found by name and updated with PUT when present).
- [ ] **Step 4:** run `pnpm --filter @tenantry/keycloak-admin test` and `test:isolation` — PASS; provisioner itest shows `tenantry-console` made by `ensureGroups`.
- [ ] **Step 5:** commit `feat(keycloak-admin): realm template v4 and console permissions`.

### Task 3: Moving people — `IdentityDirectory` reads, `RealmMembers.importMember`, `RealmIdps`, `RealmBridge`

**Files:**

- Create: `packages/keycloak-admin/src/realms/idp-copy.ts`, `src/realms/bridge.ts`, fakes `in-memory-realm-idps.ts`, `in-memory-realm-bridge.ts`, contracts `bridge-contract.ts`, itest `test-integration/realm-bridge.itest.ts`
- Modify: `identity-directory.ts` + HTTP impl + fake + contract (`getUser`, `listFederatedIdentities`, `getIdentityProvider`, `ensureBridgeClient`, `deleteBridgeClient`), `realm-members.ts` + fake + member contract (`importMember`).

**Interfaces — Produces:**

```ts
// IdentityDirectory (platform realm)
getUser(kcUserId: string): Promise<{ email: string | null; firstName: string | null; lastName: string | null; username: string } | null>;
listFederatedIdentities(kcUserId: string): Promise<{ alias: string; userId: string; userName: string }[]>;
getIdentityProvider(alias: string): Promise<{ alias: string; issuer: string; clientId: string; config: Record<string, string>; mappers: unknown[] } | null>; // clientSecret never returned
ensureBridgeClient(slug: string, redirectUri: string, secret: string): Promise<void>; // tenantry-bridge-<slug>
deleteBridgeClient(slug: string): Promise<void>;
// RealmMembers (MemberDirectory for one realm) — not on the Standard implementation
importMember(input: { email: string; firstName: string | null; lastName: string | null; role: Role | null }): Promise<{ kcUserId: string; created: boolean }>; // email verified, no email sent; reuses by email ignoring case; sets the role when given
// idp-copy.ts
export interface RealmIdps {
  copy(provider: { alias: string; issuer: string; clientId: string; config: Record<string, string>; mappers: unknown[] }, secret: string | null): Promise<{ enabled: boolean }>; // disabled when secret is null; idempotent
  setSecret(alias: string, secret: string): Promise<void>; // sets it and enables
  link(kcUserId: string, alias: string, remote: { userId: string; userName: string }): Promise<void>; // federated identity; idempotent
}
// bridge.ts
export interface RealmBridge {
  ensure(input: { slug: string; secret: string; platformIssuer: string }): Promise<void>; // provider tenantry-account + deny flow in the realm
  remove(): Promise<void>; // provider and flow
}
export const BRIDGE_ALIAS = 'tenantry-account';
export const bridgeSecretKey = (realm: string) => `${realm}/tenantry-bridge`;
export const idpSecretKey = (alias: string) => `platform/idp-${alias}`;
```

Factories `createRealmIdps({ baseUrl, realm, provisionerClientId, provisionerClientSecret, fetch? })`, `createRealmBridge({ baseUrl, internalAuthUrl, publicAuthUrl, realm, provisionerClientId, provisionerClientSecret, fetch? })` (the provider's token and keys URLs use `internalAuthUrl`, its authorization URL and issuer `publicAuthUrl`, as probed).

- [ ] **Step 1:** tests:
  - member contract `importMember reuses an account by email, ignoring case` (create `Alice@Globex.test`, import `alice@globex.test` → same id, `created: false`); `importMember sends no email and marks the email verified`; `importMember with no role gives none`.
  - identity contract: `getIdentityProvider never returns the secret` (no `clientSecret` key, or `**********` stripped); `ensureBridgeClient twice leaves one client with that secret`.
  - bridge contract (real Keycloak in `realm-bridge.itest.ts`, using `stack.ts` browser helper): `a pre-linked person signs in through the bridge with their platform password` (reaches the redirect URI); `a stranger with a platform account is refused by the bridge` (stops on Keycloak's error page, no new user in the realm); `ensure twice changes nothing`; `copy with a secret is enabled, without one is disabled; setSecret enables it`.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** implement. The deny flow is a top-level flow `tenantry-bridge-first-login` (`providerId: basic-flow`) with one execution `deny-access-authenticator` set REQUIRED, made once; the provider's `firstBrokerLoginFlowAlias` names it.
- [ ] **Step 4:** run `test` and `test:isolation` for keycloak-admin — PASS.
- [ ] **Step 5:** commit `feat(keycloak-admin): bridge, company-login copy and member import`.

### Task 4: `pnpm ops idp link` keeps the secret

**Files:** Modify `apps/ops/src/deps.ts` (`OpsDeps.secrets: SecretStore`, made from `TENANTRY_SECRETS_DIR` like the API), `apps/ops/src/commands/idp.ts`, `idp.itest.ts`, `.env.example` if a variable is new.

- [ ] **Step 1:** itest `link keeps the secret in the secrets store and nowhere else`: after `linkIdp`, `secrets.get(idpSecretKey(alias))` is the secret; `tenant_idps` row and audit metadata contain no secret; a rerun with another secret replaces it.
- [ ] **Step 2:** FAIL → **Step 3:** put the secret after Keycloak accepts the provider, inside the same flow → **Step 4:** PASS (`pnpm --filter @tenantry/ops test:isolation`).
- [ ] **Step 5:** commit `feat(ops): idp link keeps the company login's secret`.

### Task 5: API — console access

**Files:**

- Create: `apps/api/src/modules/members/console.service.ts`, `console.controller.ts` (or routes on `MembersController`), `console.itest.ts`; infrastructure `REALM_CONSOLE` factory (per realm, provisioner account, like `REALM_SCIM`) and test-app fake `t.realmConsole(realm)`.
- Modify: `members.service.ts` (`changeRole`, `remove`, `invite` on enterprise call `consoleAccess.afterRoleChange`), `MemberView` gains `console?: boolean` (enterprise only), `/api/me` adds `consoleUrl?: string`, `EnterpriseService.provision` and `upgrade` call `ensurePermissions` and `protectOwners(current owners)`, `AuditAction` gains the console actions.

**Interfaces — Produces:** `ConsoleAccessService.grant(ctx, tenant, userId)`, `.revoke(ctx, tenant, userId)`, `.afterRoleChange(tx, tenant, { kcUserId, userId, from: Role | null, to: Role | null })`, `.syncOwners(tenant): Promise<void>`.

- [ ] **Step 1:** itests:
  - `an owner gives an admin console access, and takes it back` (row, fake membership, audit `console.granted` / `console.revoked` with target user id only)
  - `refuses a member` (422 "Console access is for owners and admins."), `refuses an admin caller` (403), `Standard 404` ("Console access is available on Enterprise workspaces.")
  - `changing a console user to member takes access away` (`console.revoked`, `reason: 'role'`); `removing them does too`
  - `owner deny list follows role changes` (admin→owner adds, owner→admin and removal drop, in the same request)
  - `the members list says who has console access; /api/me gives console users the console URL`
  - `a Keycloak refusal leaves no row` (fake `failNext(400)` → 502/422, no row)
- [ ] **Step 2:** FAIL → **Step 3:** implement (one `tenantTx`; Keycloak call last before commit) → **Step 4:** PASS (`pnpm --filter @tenantry/api test:isolation`).
- [ ] **Step 5:** commit `feat(api): console access for enterprise admins`.

### Task 6: API — the move

**Files:**

- Create: `apps/api/src/modules/enterprise/migration.service.ts`, `migration.schemas.ts`, `migration.itest.ts`; a `FreezeGuard`-style check in the services that change people (`MembersService` invite/role/remove/revoke, branding, company-login operator routes): `assertNotMigrating(tenant)` from `apps/api/src/common/migrating.ts` throwing `ConflictProblem` with the freeze message.
- Modify: `enterprise.controller.ts` (routes below), `enterprise.service.ts` (extract the realm-building steps it already has into `buildRealm(tenant, vars, { firstOwnerEmail?: string })` and reuse them), infrastructure (`REALM_BRIDGE`, `REALM_IDPS` factories; test-app fakes), `AuditAction`.

**Interfaces — Consumes:** Tasks 1–3, 5. **Produces:** operator routes `POST /api/platform/enterprise-tenants/migrate` `{ slug, dryRun }` → `MigrationPlan | MigrationResult`; `POST .../migrate/finish` `{ slug }`; `POST .../migrate/abort` `{ slug }`; `PUT /api/platform/enterprise-tenants/:slug/idps/:alias/secret` `{ secret }`.

```ts
interface MigrationPlan {
  slug: string;
  realm: string;
  members: { email: string | null; role: Role | null }[];
  invites: number;
  companyLogins: { alias: string; secretKept: boolean }[];
}
interface MigrationResult extends MigrationPlan {
  cutOver: boolean;
  waitingForSecret: string[];
}
```

Order of the move (each step idempotent): status `migrating` + `startMigration` + audit `tenant.migrating` → `buildRealm` (no first-owner email) → `ensurePermissions` → bridge client (platform) + `RealmBridge.ensure` with the kept or new `bridgeSecretKey` secret → company logins `RealmIdps.copy` with `idpSecretKey` secret or null → for each org member: `getUser`, `importMember`, identity row (`issuer = new realm issuer`, `subject = kcUserId`, same `userId`; insert-if-absent), `link(…, BRIDGE_ALIAS, { userId: platformId, userName })`, and `link` for each of their company-login federated identities → `protectOwners` → open invites re-sent with `invite` and old rows revoked (`via: 'migration'`) → cut-over (`cutOverToEnterprise`, `markCutOver`, audit `tenant.migrated` with counts) → origins: the realm's product clients already carry the tenant's origins from `buildRealm`; the shared-realm clients keep theirs until finish.
Finish: `RealmBridge.remove`, `deleteBridgeClient`, `deleteOrganization(fromOrgId)`, `removeTenantOrigin` for both apps, `markFinished`, audit. Abort (only when `cutOverAt` is null): delete the realm (provisioner), the bridge client, `markAborted`, status `active`, audit.

- [ ] **Step 1:** itests (all against the fakes):
  - `the dry run lists people, roles, invites and company logins, and changes nothing`
  - `moves a workspace: same users.id through a new identity, same role, projects still there, shared-realm token 401, realm token 200`
  - `keeps the shared-realm identity for other workspaces` (person in two orgs: old identity row kept; the other workspace still answers 200 with the shared-realm token)
  - `moves a member with no role` (no role in realm; pre-linked to bridge and company login)
  - `rerun after a failure part-way through people` (fake fails `importMember` on the 2nd person; rerun → each person once, one identity each)
  - `a failure at each step finishes on rerun` (parametrised over the steps via fakes' `failOn`)
  - `freezes people changes while moving` (invite/role/remove/branding → 409 with the message; GET members and projects 200)
  - `copies a company login with its kept secret enabled, and one without disabled, naming it`; `idp secret route sets it, keeps it, enables it, audits idp.secret_set without the secret`
  - `abort before the cut-over puts everything back`; `abort after the cut-over is 409`
  - `finish removes the bridge and the organization, and is idempotent`
  - `Standard only: an enterprise slug answers 409 "Already an enterprise workspace."`
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS (`pnpm --filter @tenantry/api test:isolation`, whole suite).
- [ ] **Step 5:** commit `feat(api): move a standard workspace to enterprise`.

### Task 7: `pnpm ops enterprise migrate` and `idp-secret`

**Files:** Modify `apps/ops/src/commands/enterprise.ts` (+ test), `apps/ops/src/cli.ts` (command table), README command list.

- [ ] **Step 1:** unit tests (fake `api`): `migrate --dry-run prints the plan`; `migrate prints the result and names logins waiting for a secret, exit 0`; `migrate --finish` / `--abort` call their routes; `idp-secret reads the secret from stdin, never from an argument` (an argument → exit 1 "Pipe the secret on stdin."); non-2xx → exit 1 with the API's detail.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS (`pnpm --filter @tenantry/ops test`).
- [ ] **Step 5:** commit `feat(ops): enterprise migrate and idp-secret`.

### Task 8: Web and portal — console toggle and link (UI checklist first)

**Files:** Modify `apps/web/src/features/members/*` (a "Console access" column with a Carbon `Toggle` per owner/admin row, owners only, enterprise only; confirm-less, inline error via `ApiErrorNotification`), `apps/portal/src/features/dashboard/DashboardRoute.tsx` (a link "Open the Keycloak console" when `me.consoleUrl`), `packages/app-kit` `Me` type (`consoleUrl?: string`), tests next to each.

- [ ] **Step 0:** run `ui-consistency:finding-patterns` for the Members page change (reference: the existing Members page) and the Dashboard link; keep the checklist in the plan workspace.
- [ ] **Step 1:** tests: `owners see the console column on enterprise workspaces only`; `toggling calls POST / DELETE /api/members/:id/console and reflects the result`; `members' rows have no toggle`; `a refusal shows the API's message`; portal `console users see the console link; others don't`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS (`pnpm --filter @tenantry/web test`, `pnpm --filter @tenantry/portal test`).
- [ ] **Step 5:** commit `feat(web): console access on the members page` (portal link in the same commit).

### Task 9: Isolation guarantees

**Files:** Create `tests/isolation/src/phase5b.test.ts`; helpers as needed (`operatorToken` from the seed's ops client if not present, a `migrate(slug)` helper calling the operator route); README rows.

- [ ] **Step 1:** tests on the running stack:
  - `moves a Standard workspace made here, and its member signs in through the bridge with their old password, with the same role and projects`
  - `a stranger with a shared-realm account is refused by the bridge`
  - `a shared-realm token for the moved workspace gets 401`
  - `finish removes the bridge`
  - `Initech: a console user can edit a member but not an owner, cannot grant console access, and cannot reach clients or the realm`
  - `Initech's console user sees nothing of another realm` (403/404 on `/admin/realms/ent-<other>/users`)
    Clean up: revoke console access, delete people made here; the moved workspace is left finished (each run makes its own).
- [ ] **Step 2:** `pnpm dev:stack`, `pnpm seed` (Initech upgrades to v4), `pnpm test:isolation` — PASS; files run one at a time.
- [ ] **Step 3:** README rows `tested`; commit `test: phase 5b guarantees`.

### Task 10: Docs and the gate

**Files:** `docs/decisions/0025-standard-to-enterprise.md`, `0026-console-access.md`, `docs/decisions/README.md`, updates to ADR-0007 (the migration is built), ADR-0010 (template v4), ADR-0022 (secret kept at link time), `docs/guides/move-to-enterprise.md` (operator: dry run, move, company-login secrets, finish, abort; customer: the bridge button, console access), `docs/known-issues.md` (no way back after the cut-over; console edits only in Keycloak's admin events; bridge stays until finish; the secret kept for older links only after `idp-secret`), `CHANGELOG.md`, `README.md` (status, tier table "MFA… / console", roadmap: Phase 5 done), `AGENTS.md` (`RealmConsole`, `RealmBridge`, `RealmIdps`; the ops commands).

- [ ] **Step 1:** write the docs.
- [ ] **Step 2:** the gate: `pnpm lint typecheck test build`, `pnpm test:scripts`, fresh `pnpm dev:stack`, `pnpm smoke`, `pnpm seed` ×2, `pnpm test:isolation` — all pass; `ui-consistency:verifying` against Task 8's checklist by a separate agent.
- [ ] **Step 3:** commit `docs: phase 5b`.

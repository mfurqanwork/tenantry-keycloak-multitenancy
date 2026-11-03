# Tenantry Phase 3 (Enterprise realm provisioning) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator provisions an Enterprise tenant (realm `ent-<slug>`) through the API; both apps, members, projects, audit and branding work on it; tokens from any other realm are refused.

**Architecture:** `packages/keycloak-admin` gains a `RealmProvisioner` (master-realm `create-realm` credential), a `RealmMembers` directory (one realm's users + `tenantry-api` client roles, with that realm's `tenantry-backend` credential) and a `SecretStore`. The API's guard extracts roles by tier, members go through a tier-agnostic `MemberDirectory`, and a new `enterprise` module exposes operator-only provisioning and upgrade endpoints that `pnpm ops` calls.

**Tech Stack:** Keycloak 26.8.1 Admin API (realms, client policies, client roles, execute-actions-email), NestJS 11, Drizzle/Postgres, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-04-tenantry-phase3-design.md`. Known issues: `docs/known-issues.md`.

## Global Constraints

- AGENTS.md hard rules 1–7 hold. Keycloak admin calls only in `packages/keycloak-admin`. Rule 2 for Enterprise: roles only from `resource_access.tenantry-api.roles`.
- Realm name `ent-<slug>`; issuer `${TENANTRY_AUTH_URL}/realms/ent-<slug>`; template version `1`.
- Product clients per realm: `tenantry-web`, `tenantry-portal` (public, PKCE S256, redirect `${origin}/*`, web origins), `tenantry-api` (bearer-only, client roles `owner`, `admin`, `member`), `tenantry-backend` (confidential, service account with realm-management `manage-users`, `view-users`, `manage-clients`).
- Client policies: PKCE S256 required, no wildcard redirect URIs, no implicit flow.
- Operator token: issuer `platform`, `azp === 'tenantry-ops'`, audience `tenantry-api`.
- Provisioner: master-realm client `tenantry-provisioner`, service account with only the master realm role `create-realm`. Env: `KEYCLOAK_PROVISIONER_CLIENT_ID`, `KEYCLOAK_PROVISIONER_CLIENT_SECRET`, `TENANTRY_SECRETS_DIR` (default `.secrets`).
- Secrets never in Postgres, logs or audit metadata.
- Every identity change audited; every new endpoint gets an isolation test.
- Conventional Commits, no attribution lines; no push or merge without the person.

## Review Focus

1. **A rerun after a failure in each provisioning step** must finish the tenant without duplicating realms, clients, secrets or the first admin. Saga itest per step.
2. **A Standard user's token on an Enterprise host** (and the reverse) must get 401, never a role. Isolation test.
3. **The backend secret** must never appear in API responses, logs or audit metadata. Unit test on the provisioning response and audit rows.
4. **Upgrade dry run** must change nothing in Keycloak. Contract test compares the realm before and after.
5. **Inviting an existing realm user** on an Enterprise tenant must give them the role without a second account; revoking must not delete someone who has signed in. Itest.

---

### Task 1: Template spike — realm template, product clients, provisioner account

**Files:** Create `infra/keycloak/templates/enterprise-realm.v1.json`, `infra/keycloak/templates/product-clients/{tenantry-web,tenantry-portal,tenantry-api,tenantry-backend}.json`, `scripts/lib/provisioner.mjs` (+ `.test.mjs`), `packages/keycloak-admin/src/realms/templates.ts` (+ test). Modify `scripts/dev-stack.mjs`, `.env.example`, `scripts/lib/realm.test.mjs`.

**Interfaces — Produces:** `loadRealmTemplate(version: number): RealmTemplate`, `loadProductClients(origins: { web: string; portal: string }): ClientTemplate[]` (substitutes `${WEB_ORIGIN}`, `${PORTAL_ORIGIN}`); `ensureProvisionerClient({ baseUrl, adminUser, adminPassword, clientId, secret })` in `scripts/lib/provisioner.mjs` (idempotent; dev-stack calls it after Keycloak is healthy).

- [ ] Tests: `realm.test.mjs` asserts the template's PKCE/no-wildcard/no-implicit client policies, `verifyEmail`, `loginTheme: tenantry`, and that `tenantry-api` defines exactly `owner`, `admin`, `member`; `templates.test.ts` asserts origin substitution and that no template contains a secret.
- [ ] Spike: apply the template + clients to a throwaway realm with a provisioner-created token (contract itest in Task 3 pins it); if Keycloak refuses the client-policies JSON, fix the shape here.
- [ ] Commit `feat: enterprise realm template and provisioner account`.

### Task 2: SecretStore

**Files:** Create `packages/keycloak-admin/src/secrets/{secret-store.ts,file-secret-store.ts,file-secret-store.test.ts,index.ts}`, `docs/decisions/0023-realm-secrets.md`. Modify `.gitignore` (`.secrets/`), package exports `./secrets`.

**Produces:** `interface SecretStore { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }`; `createFileSecretStore(dir: string): SecretStore` (one JSON file per key prefix `ent-<slug>`, file mode 0600 where supported, atomic write via rename).

- [ ] Tests: put/get round trip; missing → null; second put overwrites; keys outside `[a-z0-9-/]` refused; the file never lands outside `dir`.
- [ ] Commit `feat(keycloak-admin): secret store`.

### Task 3: RealmProvisioner and template diff

**Files:** Create `packages/keycloak-admin/src/realms/{provisioner.ts,template-diff.ts,template-diff.test.ts}`, `packages/keycloak-admin/src/testing/in-memory-provisioner.ts`, `packages/keycloak-admin/test-integration/provisioner.itest.ts`.

**Produces:**

- `interface RealmProvisioner { ensureRealm(realm): Promise<{ created: boolean }>; applyTemplate(realm, template): Promise<void>; ensureClients(realm, clients): Promise<void>; setBackendSecret(realm, secret): Promise<void>; ensureFirstAdmin(realm, email): Promise<{ created: boolean; kcUserId: string }>; smokeTest(realm, backendSecret): Promise<void>; diff(realm, template, clients): Promise<TemplateDiff[]>; }`
- `TemplateDiff = { path: string; live: unknown; template: unknown }`; `diffTemplate(template: object, live: object, prefix?: string): TemplateDiff[]` — compares only keys present in the template (objects recursively, arrays as wholes).
- `createHttpRealmProvisioner({ baseUrl, clientId, clientSecret, fetch? })`; `InMemoryRealmProvisioner` with `failOn(step)`.

- [ ] Tests: `diffTemplate` (extra live keys ignored, nested change reported, equal → []); itest on real Keycloak: run all steps twice on `ent-it<random>` → second run creates nothing; `diff` after `applyTemplate` is `[]`; changing a live value makes `diff` report it and a dry run (diff only) leaves it unchanged; first admin gets the `owner` role on `tenantry-api` and an execute-actions email reaches Mailpit; cleanup deletes the realm with the bootstrap admin.
- [ ] Commit `feat(keycloak-admin): realm provisioner and template diff`.

### Task 4: RealmMembers (Enterprise member directory)

**Files:** Create `packages/keycloak-admin/src/realms/realm-members.ts`, `packages/keycloak-admin/src/member-directory.ts`, `packages/keycloak-admin/src/testing/in-memory-realm-members.ts`, contract `src/testing/member-contract.ts` run in `src/in-memory.test.ts` and `test-integration/realm-members.itest.ts`.

**Produces:** `interface MemberDirectory { listMembers(): Promise<DirectoryMember[]>; invite(email: string, role: Role): Promise<{ kcUserId: string | null }>; setRole(kcUserId: string, role: Role): Promise<void>; remove(kcUserId: string): Promise<void>; deleteUnusedUser(kcUserId: string): Promise<boolean> }`; `organizationMembers(directory: IdentityDirectory, orgId: string): MemberDirectory` (invite → `inviteUser`, returns null id); `createRealmMembers({ baseUrl, realm, clientSecret, fetch? }): MemberDirectory` — members are users holding any `tenantry-api` client role; `invite` finds or creates the user (email verified false), sets the role, sends execute-actions `UPDATE_PASSWORD`,`VERIFY_EMAIL`; `remove` takes the roles away (the account stays in the realm); `deleteUnusedUser` deletes only a user who never signed in (no sessions and no `lastLogin` event; Keycloak's `createdTimestamp` + `requiredActions` still pending).

- [ ] Tests: the member contract (list empty, invite → member with role, setRole moves the role, remove → not listed, invite of an existing user gives a role without a new account) on fake and real.
- [ ] Commit `feat(keycloak-admin): realm member directory`.

### Task 5: Tier-aware platform repository

**Files:** Modify `packages/db/src/repositories/platform.ts`, `packages/db/test-integration/phase2.itest.ts` (or new `phase3.itest.ts`).

**Produces:** `TenantRecord.tier: 'standard' | 'enterprise'`, `templateVersion: number | null`; `findTenantBySlug` no longer filters tier; `insertProvisioningTenant({ slug, name, tier? })`; `activateTenant(id, { realm, issuer, kcOrgId: string | null, templateVersion?: number })`; `setTemplateVersion(id, version)`; `listActiveTenants({ tier? })`.

- [ ] Tests: enterprise row round trip; standard lookups unchanged; `listActiveTenants({ tier: 'enterprise' })`.
- [ ] Commit `feat(db): tenants of both tiers`.

### Task 6: Guard — tier roles, identity refresh, OperatorOnly

**Files:** Modify `apps/api/src/auth/{role-claims.ts,role-claims.test.ts,tenant-auth.guard.ts,tenant-auth.guard.itest.ts,decorators.ts}`, `packages/db/src/repositories/platform.ts` (`upsertIdentity` refreshes email/name), `apps/api/src/testing/{test-app.ts,tokens.ts}` (issuers per realm).

**Produces:** `rolesFromClientRoles(payload, clientId = 'tenantry-api'): Membership`; guard: enterprise tenants use it, standard keeps `rolesFromClaims`; the identity row is upserted only after membership is known (or before an invite claim); `upsertIdentity` updates `email` and `display_name` when they changed; `@OperatorOnly()` (platform issuer, `azp === 'tenantry-ops'`, audience `tenantry-api`) sets `req.operator = { clientId }`.

- [ ] Tests: unit for client-role extraction (ignores `realm_access`, other clients, unknown roles); itests: enterprise owner token → 200; platform token on enterprise host → 401; enterprise token on standard host → 401; non-member → 403 and no `users` row created; email change in the token updates the user; operator endpoint refuses a user token (403) and a missing token (401).
- [ ] Commit `feat(api): enterprise path in the guard, identity refresh, operator-only routes`.

### Task 7: Members on both tiers

**Files:** Create `apps/api/src/infrastructure/member-directories.ts`; modify `infrastructure.module.ts`, `tokens.ts` (`MEMBER_DIRECTORIES`), `modules/members/members.service.ts` (+ itest), `auth/invite-claimer.ts`.

**Produces:** `interface MemberDirectories { forTenant(tenant: TenantRecord): Promise<MemberDirectory> }` — Standard → `organizationMembers`; Enterprise → `createRealmMembers` with the secret from the `SecretStore` (cached per realm). Members service uses it everywhere; invites on Enterprise create the user with the role; revoking deletes a never-signed-in user created by that invite; the guard marks an Enterprise member's open invite accepted on first sign-in and audits `member.joined`.

- [ ] Tests: the existing members itests pass for Standard; new itests run list/invite/change role/remove/leave on an enterprise test tenant with the in-memory realm directory; revoke of an unused invitee deletes the user, of a signed-in one does not.
- [ ] Commit `feat(api): members on enterprise tenants`.

### Task 8: Enterprise module — provisioning and upgrade

**Files:** Create `apps/api/src/modules/enterprise/{enterprise.module.ts,enterprise.controller.ts,enterprise.service.ts,enterprise.schemas.ts,enterprise.itest.ts}`; modify `config/config.ts` (+ test), `infrastructure.module.ts` (`REALM_PROVISIONER`, `SECRET_STORE`), `app.module.ts`, `.env.example`, `infra/docker-compose.yml` (api env + `.secrets` volume), `audit.service.ts` (`tenant.provisioning`, `tenant.upgraded`).

**Produces:** `POST /api/platform/enterprise-tenants` `{ slug, name, adminEmail }` → `{ slug, status, webUrl, portalUrl }` (201 new, 200 already active, 409 standard slug, 422 bad slug); `POST /api/platform/enterprise-tenants/upgrade` `{ slug?, dryRun: boolean }` → `[{ slug, realm, fromVersion, toVersion, differences: TemplateDiff[], applied: boolean }]`. Steps exactly as the spec; each step idempotent; tenant stays `provisioning` on failure; 502 on Keycloak failure.

- [ ] Tests (in-memory provisioner + file store in a temp dir): happy path; each step `failOn` → 502, then a rerun completes with one realm, one secret, one admin; response and audit rows contain no secret; dry run applies nothing; upgrade raises `template_version`; operator-only.
- [ ] Commit `feat(api): enterprise provisioning and upgrades`.

### Task 9: Apps and the header link

**Files:** Modify `apps/api/src/modules/tenants/tenants.service.ts` (+ itest: enterprise auth-config), `packages/ui/src/shell/AppShell.tsx` (+ test: product name uses `linkAs`), `apps/api/src/modules/workspaces/workspaces.service.ts` (+ itest: enterprise lists only itself).

- [ ] Tests first as listed; commit `feat: enterprise sign-in for both apps; header name link stays in the app`.

### Task 10: Ops commands, seed, CI

**Files:** Create `apps/ops/src/commands/enterprise.ts` (+ unit test with a fake API), modify `apps/ops/src/cli.ts`, `apps/ops/src/seed/seed.ts`, `.github/workflows/ci.yml`.

**Produces:** `pnpm ops enterprise provision --slug --name --admin-email`, `pnpm ops enterprise upgrade [--tenant] [--dry-run]` — get a `tenantry-ops` client-credentials token (audience mapper added to `tenantry-ops` in the platform realm) and call the API on the base domain; print the result or the problem detail; exit 1 on refusal. Seed provisions `initech` with `owner@initech.test` and sets its password and brand (blue-grey `#4d5358`); second run changes nothing.

- [ ] Tests: command maps API answers to output and exit codes; seed twice → "nothing to change".
- [ ] Commit `feat(ops): enterprise provision and upgrade commands; seed initech`.

### Task 11: Isolation tests and the company-login guard test

**Files:** Create `tests/isolation/src/phase3.test.ts`, `tests/isolation/src/helpers/browser-flow.ts` (cookie-jar form walker for Keycloak pages).

- [ ] Tests: Initech owner token on Initech → 200; platform token on Initech → 401; token from another `ent-*` realm on Initech → 401; token with the wrong audience → 401; Initech owner token on a Standard host → 401; `pnpm ops enterprise upgrade --dry-run` reports no differences on a fresh realm; corp-demo user asserting `pat@example.test` through `acme-corp` ends on "Email domain does not match any domain from the organization".
- [ ] Commit `test: phase 3 guarantees`.

### Task 12: Docs, gate and walk

- [ ] README Phase 3 rows → `tested`, status line, tier notes; ADR-0010 note (endpoint + command), ADR-0023; `docs/known-issues.md` (fold-ins struck, new rows); CHANGELOG `Unreleased`; AGENTS.md (enterprise rule 2 wording unchanged, new commands).
- [ ] Gate: `pnpm lint typecheck test build`, `pnpm dev:stack`, `pnpm seed` ×2, `pnpm smoke`, `pnpm test:isolation`; browser: Initech owner via Mailpit link → both apps, members invite, branding on the login page.
- [ ] Commit `docs: phase 3`.

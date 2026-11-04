# Tenantry Phase 5a: SCIM and security settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enterprise owners connect their company directory to their realm through a Tenantry SCIM gateway with a long-lived revocable token, and set their realm's two-step, password, session and lockout rules from the portal.

**Architecture:** A `/scim/v2` gateway in the API checks a hashed Tenantry token inside the host's tenant, then forwards to Keycloak's native SCIM with a short-lived token of a per-realm `tenantry-scim` client, granting the default role after person changes. Security settings live in `tenant_security` (forced RLS) and are written to the realm by the provisioner account; realm template v3 adds the second-step subflow, recovery codes and the two mapped groups, and upgrades merge tenant settings over template defaults.

**Tech Stack:** NestJS 11, Drizzle + Postgres 17, Keycloak 26.8.1 (native SCIM, admin REST), React 19 + Carbon 11, Vitest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-06-tenantry-phase5a-design.md`

## Global Constraints

- AGENTS.md hard rules 1–7 and UI rules apply to every task; Conventional Commits; no attribution lines in commits.
- Enterprise only. Standard workspace → 404 `Security settings and SCIM are available on Enterprise workspaces.` (API and portal). Every new endpoint needs `tenant:settings`.
- SCIM token: `tnt_scim_` + 32 random bytes base64url; stored only as SHA-256 hash; expiry 90, 180 or 365 days; one active per tenant; never logged, audited or shown again.
- Gateway: `/scim/v2/*` on the tenant host, `ScimTokenGuard` only; SCIM error body `{ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: '<code>', detail }`; 401 bad token, 404 not an active enterprise workspace, 413 over 1 MB, 502 Keycloak unreachable.
- Mapped groups `tenantry-members` → `member`, `tenantry-admins` → `admin`; owners never via SCIM; DELETE of a mapped group empties it.
- Settings bounds: two-step `off|optional|required`; password min length 12–64, history 0–24, expiry 0–365 days; session idle 15–720 minutes, max 1–24 hours, idle ≤ max; lockout failures 3–20, wait 1–60 minutes; SCIM default role `member|none`. Defaults = template v2 values (length 12, history 0, expiry 0, idle 30, max 10, failures 10, wait 15, two-step `optional`, role `member`).
- Audit actions: `security.updated`, `scim.token_created`, `scim.token_revoked`, `scim.user_created`, `scim.user_updated`, `scim.user_deactivated`, `scim.group_changed`, `scim.role_grant_failed`; SCIM actor `null` with `via: 'scim'`.

## Review Focus

1. Entra sends `PATCH` with `{ op: 'Replace', path: 'active', value: 'False' }` (string, capitalised op) → treated as a deactivation: no role grant, audited `scim.user_deactivated` (Task 9 test `entra-style deactivate`).
2. `authorization: bearer tnt_scim_…` (lower-case scheme, extra spaces) → accepted; any other scheme → 401 (Task 9 test `scheme is case-insensitive`).
3. SCIM filters like `filter=userName eq "a+b@corp.test"` → forwarded byte-for-byte (Task 9 test `query passes through encoded`).
4. Two owners generate a token at the same moment → exactly one active token remains (Task 8 test `one active token under concurrency`).
5. Settings with idle longer than max (e.g. idle 720 min, max 1 h) → 422 from the API with the shared message, nothing applied (Task 1 + Task 7 tests).

---

### Task 1: Security settings schema (`packages/auth`)

**Files:** Create `packages/auth/src/security.ts` (+ `.test.ts`); modify `packages/auth/src/index.ts`.

**Interfaces — Produces:**

- `type TwoStep = 'off' | 'optional' | 'required'`; `type ScimDefaultRole = 'member' | 'none'`
- `interface SecuritySettings { twoStep; passwordMinLength; passwordHistory; passwordExpiryDays; sessionIdleMinutes; sessionMaxHours; lockoutFailures; lockoutWaitMinutes; scimDefaultRole }`
- `const SECURITY_DEFAULTS: SecuritySettings`, `const SECURITY_BOUNDS` (min/max per numeric field)
- `securityProblems(s: SecuritySettings): Partial<Record<keyof SecuritySettings, string>>` — messages `Use a whole number from <min> to <max>.` and for idle > max on `sessionIdleMinutes`: `A session cannot sit idle longer than it may last.`

- [ ] **Step 1:** tests: defaults have no problems; each numeric field accepted at min and max, refused at min−1 and max+1 with the message; non-integers refused; idle 720 / max 1 refused with the idle message; idle 60 / max 1 accepted.
- [ ] **Step 2:** `pnpm --filter @tenantry/auth test` — FAIL (module missing).
- [ ] **Step 3:** implement (no dependency).
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5:** commit `feat(auth): security settings and their bounds`.

### Task 2: Tables `tenant_scim_tokens` and `tenant_security` (`packages/db`)

**Files:** `migrations/0004_phase5a.sql` (+ journal), `src/schema/tenant-scim-tokens.ts`, `src/schema/tenant-security.ts`, `src/repositories/scim-tokens.ts`, `src/repositories/security.ts`, `test-integration/phase5a.itest.ts`, `test-integration/repositories.itest.ts`, exports.

**Interfaces — Produces (all take `tx: TenantTx`):**

- `insertScimToken(tx, { tokenHash: Buffer; expiresAt: Date; createdBy: string | null }): Promise<ScimTokenRecord>` (revokes the active one first, same transaction), `findActiveScimToken(tx): Promise<ScimTokenRecord | null>`, `findScimTokenByHash(tx, hash: Buffer): Promise<ScimTokenRecord | null>`, `revokeScimTokens(tx): Promise<number>`, `touchScimToken(tx, id: string): Promise<void>` (sets `last_used_at` only if null or older than 60 s), `lockTenantScim(tx)`
- `ScimTokenRecord { id; expiresAt; createdBy; createdAt; lastUsedAt; revokedAt }` (no hash)
- `getSecurity(tx): Promise<SecuritySettings | null>`, `putSecurity(tx, s: SecuritySettings, updatedBy: string): Promise<void>`

- [ ] **Step 1:** tests: phase5a isolation guarantee for both tables (another tenant sees and writes nothing; no tenant set → nothing); partial unique index `tenant_scim_tokens_one_active` refuses a second active row; insert revokes the previous; hash lookup finds only within the tenant; touch throttled; security round trip; check constraints refuse `two_step = 'sometimes'`.
- [ ] **Step 2:** `pnpm --filter @tenantry/db test:isolation` — FAIL.
- [ ] **Step 3:** implement (columns as the spec's Data model; `token_hash bytea not null unique`; checks mirror Task 1 bounds).
- [ ] **Step 4:** run — PASS.
- [ ] **Step 5:** commit `feat(db): scim tokens and security settings with forced row-level security`.

### Task 3: Template v3 and the second-step probe (`packages/keycloak-admin`)

**Files:** `templates/enterprise-realm.v3.json`, `src/realms/templates.ts` (`TEMPLATE_VERSION = 3`, `MAPPED_GROUPS`), `src/realms/templates.test.ts`, `scripts/lib/realm.test.mjs`, `test-integration/second-step.itest.ts`.

**Interfaces — Produces:** `MAPPED_GROUPS = { 'tenantry-members': 'member', 'tenantry-admins': 'admin' } as const`; template v3 realm keys `browserFlow: 'tenantry-browser'` and the flow export under `authenticationFlows` (top-level browser flow: cookie | identity-provider-redirector | forms subflow → username-password form + `tenantry-second-step` subflow with alternatives `auth-otp-form`, `webauthn-authenticator`, `auth-recovery-authn-code-form`); required action `CONFIGURE_RECOVERY_AUTHN_CODES` enabled.

- [ ] **Step 1 (probe first, throwaway realm):** an itest that builds the flow on a realm, sets the subflow to REQUIRED, signs in a password-only user with the browser flow helper and expects a set-up step (OTP or credential choice) instead of a code; then CONDITIONAL with a `conditional-user-configured` sub-condition and expects a code straight away. Ledger the outcome; if REQUIRED-with-alternatives does not ask for set-up, switch "required" to `auth-otp-form` REQUIRED alone and record the ruling.
- [ ] **Step 2:** unit tests: v3 has `browserFlow: 'tenantry-browser'`, the subflow with the three alternatives, recovery codes enabled, `templateVersion` 3; script test reads v3.
- [ ] **Step 3:** run unit, scripts, itest — FAIL until v3 exists.
- [ ] **Step 4:** implement v3 (copy v2, add flow and required action; `applyTemplate` must create the flow when missing — extend `RealmProvisioner.applyTemplate` to POST flows/executions idempotently, keyed by alias).
- [ ] **Step 5:** run — PASS (unit, scripts, `test:isolation` for keycloak-admin). Commit `feat(keycloak-admin): realm template v3 with a second sign-in step`.

### Task 4: Realm security and mapped groups through the provisioner

**Files:** `src/realms/security.ts` (+ `.test.ts`), `src/realms/provisioner.ts`, `src/testing/in-memory-provisioner.ts`, `test-integration/provisioner.itest.ts`.

**Interfaces — Produces:**

- `securityRealmPatch(s: SecuritySettings): Record<string, unknown>` — pure: `passwordPolicy` (`length(n) and notUsername and notEmail` + ` and passwordHistory(n)` if > 0 + ` and forceExpiredPasswordChange(n)` if > 0), `ssoSessionIdleTimeout` (s), `ssoSessionMaxLifespan` (s), `bruteForceProtected: true`, `failureFactor`, `waitIncrementSeconds`, `maxFailureWaitSeconds` (both = wait × 60).
- `RealmProvisioner.applySecurity(realm, s: SecuritySettings): Promise<void>` — PUT the patch and set `tenantry-second-step` requirement: `off` → DISABLED, `optional` → CONDITIONAL, `required` → REQUIRED (or Task 3's fallback).
- `RealmProvisioner.ensureGroups(realm): Promise<void>` — creates `MAPPED_GROUPS` with their `tenantry-api` client-role mappings, idempotent.
- `mergeSecurity(template: RealmTemplate, s: SecuritySettings | null): RealmTemplate` — template with the patch applied (for upgrade diffs).

- [ ] **Step 1:** unit tests for `securityRealmPatch` per field and `mergeSecurity(t, null)` returns `t`; contract (fake + real): `applySecurity` then read back realm keys and the flow requirement for each `twoStep`; `ensureGroups` twice → two groups with the right role mappings.
- [ ] **Step 2–4:** FAIL → implement (provision calls `ensureGroups` after `ensureClients`) → PASS.
- [ ] **Step 5:** commit `feat(keycloak-admin): apply security settings and the mapped groups`.

### Task 5: `RealmScim` — SCIM switch, client and its token

**Files:** `src/realms/scim.ts`, `src/testing/in-memory-realm-scim.ts`, `src/testing/scim-contract.ts`, `test-integration/realm-scim.itest.ts`, exports.

**Interfaces — Produces:**

- `interface RealmScim { enable(): Promise<void>; disable(): Promise<void>; accessToken(): Promise<string>; forward(req: { method: string; path: string; query: string; body?: Buffer; contentType?: string }): Promise<{ status: number; headers: Record<string, string>; body: Buffer }>; grantRole(kcUserId: string, role: 'member'): Promise<void>; isMappedGroup(groupId: string): Promise<boolean>; emptyGroup(groupId: string): Promise<void> }`
- `createRealmScim(o: { baseUrl: string; publicIssuer: string; realm: string; provisioner: RealmProvisioner; secrets: SecretStore; fetch? })` — `enable` sets `scimApiEnabled`, ensures `tenantry-scim` (confidential, service account, `access.token.lifespan` 300, audience mapper `<publicIssuer>/scim/v2`, realm-management `manage-users`, `view-users`, `query-users`, `query-groups`, `manage-clients` not included) with its secret in the store (`<realm>/tenantry-scim`); `accessToken` caches until 60 s before expiry; `forward` calls `<baseUrl>/realms/<realm>/scim/v2/<path>?<query>`.
- `InMemoryRealmScim` with `users`/`groups` maps and `failNext`.

- [ ] **Step 1:** contract (fake + real): enable twice is fine; forward `GET Users` 200 list; POST a user then GET it; `grantRole` makes the user a `member`; `isMappedGroup` true for the two groups, false for another; `emptyGroup` removes members; disable → forward answers 401/404 from Keycloak.
- [ ] **Step 2–4:** FAIL → implement → PASS (real Keycloak via `stack.ts`).
- [ ] **Step 5:** commit `feat(keycloak-admin): realm scim client and forwarding`.

### Task 6: Members listed through mapped groups

**Files:** `src/realms/realm-members.ts`, `src/testing/in-memory-realm-members.ts`, `src/testing/member-contract.ts`.

- [ ] **Step 1:** contract test `lists people who hold a role through a mapped group, the higher role winning`: a user added to `tenantry-admins` (and directly `member`) is listed as `admin`; removed from the group → `member`.
- [ ] **Step 2–4:** FAIL → read `/clients/{api}/roles/{role}/groups` and each group's `/members` in `listMembers` → PASS (fake + real).
- [ ] **Step 5:** commit `feat(keycloak-admin): members include roles held through groups`.

### Task 7: API security module and upgrade merge

**Files:** `apps/api/src/modules/security/{security.module,security.controller,security.service,security.schemas}.ts`, `security.itest.ts`; `modules/enterprise/enterprise.service.ts` (upgrade merges), `app.module.ts`, `audit.service.ts` actions, `testing/test-app.ts` (provisioner fake records `applySecurity`).

**Interfaces — Produces:** `GET /api/security` → `SecuritySettings`; `PUT /api/security` (body = `SecuritySettings`, Zod via Task 1's `securityProblems`, field paths) → saved settings; `SecurityService.current(tenant)`.

- [ ] **Step 1:** itests: GET returns defaults; PUT applies (fake provisioner sees the settings), stores, audits before/after; admin → 403; Standard → 404 sentence; provisioner `failNext(400)` → 422 with Keycloak's reason and the row unchanged; `idle 720 / max 1` → 422 `sessionIdleMinutes: A session cannot sit idle longer than it may last.`; upgrade dry run after saving custom settings reports no differences, and after a console edit (fake drift) reports it.
- [ ] **Step 2–4:** FAIL → implement → PASS (`pnpm --filter @tenantry/api test:isolation`).
- [ ] **Step 5:** commit `feat(api): security settings for enterprise workspaces`.

### Task 8: API SCIM token management

**Files:** `apps/api/src/modules/scim/{scim.module,scim-admin.controller,scim-tokens.service,scim.schemas,tokens}.ts`, `scim-admin.itest.ts`; infrastructure `REALM_SCIM` factory (`perRealm`) and test-app fake.

**Interfaces — Produces:** `newScimToken(): { token: string; hash: Buffer }`, `hashScimToken(token: string): Buffer`; `GET /api/scim` → `{ url, token: { expiresAt, lastUsedAt, createdAt } | null, defaultRole }`; `POST /api/scim/token` `{ expiresInDays: 90 | 180 | 365 }` → 201 `{ token, expiresAt }`; `DELETE /api/scim/token` → 204; `PUT /api/scim/default-role` `{ role }`.

- [ ] **Step 1:** tests: token format and hash unit tests; itests: first token enables SCIM on the realm fake; response holds the token once, table holds only the hash, GET never returns it; second token revokes the first; revoke disables SCIM; audit entries carry expiry and never the token; `one active token under concurrency` (two parallel POSTs → one active row); admin 403; Standard 404.
- [ ] **Step 2–4:** FAIL → implement (token POST under `lockTenantScim`) → PASS.
- [ ] **Step 5:** commit `feat(api): scim tokens for enterprise workspaces`.

### Task 9: SCIM gateway

**Files:** `apps/api/src/modules/scim/{scim-token.guard,scim-gateway.controller,scim-gateway.service}.ts`, `scim-gateway.itest.ts`, `scim-gateway.test.ts`; `main.ts` and `test-app.ts` (`setGlobalPrefix('api', { exclude: [{ path: 'scim/v2/{*path}', method: RequestMethod.ALL }] })`, raw body ≤ 1 MB for that route); `infra/Caddyfile` (`handle /scim/*` → API on tenant hosts); `scripts/lib/compose.test.mjs` or a new Caddyfile test.

**Interfaces — Consumes:** Tasks 2, 5, 8. **Produces:** `ALL /scim/v2/*`.

- [ ] **Step 1:** unit tests (`scim-gateway.test.ts`): `isDeactivation(body)` true for `{ active: false }`, Entra-style `entra-style deactivate` (`Operations: [{ op: 'Replace', path: 'active', value: 'False' }]`) and `value: { active: false }`; `rewriteLocation` swaps Keycloak's base for the gateway's. Itests: no/garbage/revoked/expired token → 401 SCIM body; `scheme is case-insensitive`; token of tenant A on tenant B → 401; Standard → 404; `query passes through encoded`; POST /Users → 201 with rewritten `Location`, default role granted, audit `scim.user_created`; default role `none` → no grant; PATCH deactivation → no grant, audit `scim.user_deactivated`; DELETE /Groups/<mapped> → group emptied, 204; DELETE other group → forwarded; body over 1 MB → 413; fake Keycloak down → 502; a person's token on `/scim` → 401 and a SCIM token on `/api/me` → 401.
- [ ] **Step 2–4:** FAIL → implement → PASS; Caddy test passes.
- [ ] **Step 5:** commit `feat(api): scim gateway`.

### Task 10: Portal — Security settings page (UI checklist first)

**Files:** `apps/portal/src/features/security/SecurityRoute.tsx` (+ test), `App.tsx` (nav `Security`, `needs: 'tenant:settings'`).

- [ ] **Step 0:** run `ui-consistency:finding-patterns` for this page and Task 11's (reference: portal `BrandingRoute`, a `SettingsPage`); keep the checklist in the plan workspace.
- [ ] **Step 1:** tests: loads current settings; fields grouped (Two-step sign-in, Passwords, Sessions, Lockout) with bounds as helper text; inline errors from `securityProblems`; save bar disabled until changed and while invalid; save PUTs the whole object and shows success; API 422 shown; Standard sentence; non-owner sees no nav item.
- [ ] **Step 2–4:** FAIL → implement from `SettingsPage` → PASS.
- [ ] **Step 5:** commit `feat(portal): security settings`.

### Task 11: Portal — SCIM page

**Files:** `apps/portal/src/features/scim/ScimRoute.tsx` (+ test), `App.tsx` (nav `Directory sync (SCIM)`).

- [ ] **Step 1:** tests: shows URL with copy; no token → "Generate token" with expiry select (90/180/365); generate shows the token once in a warning notification with copy, gone after reload; active token shows expiry and last use, "Replace token" (confirm dialog says the old one stops at once) and "Revoke" (danger confirm); default role select saves; Standard sentence.
- [ ] **Step 2–4:** FAIL → implement (`SettingsPage`, `FormDialog`, `CodeSnippet`) → PASS.
- [ ] **Step 5:** commit `feat(portal): directory sync page`.

### Task 12: Isolation guarantees

**Files:** `tests/isolation/src/phase5a.test.ts`, `README.md` rows.

- [ ] **Step 1:** tests on the seeded stack (Initech owner via browser flow; token via `POST /api/scim/token`): token of Initech on another enterprise tenant's `/scim` → 401; owner's access token on `/scim` → 401; SCIM token on `/api/me` → 401; revoked → 401; SCIM-created user exists only in `ent-initech` and, after setting a password through the admin helper, signs in to Tenantry as `member`; with two-step `required`, a password-only sign-in does not reach the redirect (set-up page shown). Clean up: revoke token, delete created users, restore settings.
- [ ] **Step 2:** `pnpm test:isolation` on a freshly seeded stack — PASS.
- [ ] **Step 3:** README rows (`tested`), commit `test: phase 5a guarantees`.

### Task 13: Docs and the gate

**Files:** `docs/decisions/0024-scim-gateway.md`, `docs/decisions/0010-realm-templates.md` (update), `docs/decisions/README.md`, `docs/guides/connect-scim.md`, `docs/known-issues.md`, `CHANGELOG.md`, `AGENTS.md`, `README.md` (status, tier table, roadmap).

- [ ] **Step 1:** write the docs (guide: Entra ID enterprise app → Provisioning → Tenant URL + Secret Token, attribute mapping notes, group names; Okta: SCIM 2.0 app, Bearer header; deactivation; revoke and replace; the default role).
- [ ] **Step 2:** gate: `pnpm lint typecheck test build`, `pnpm test:scripts`, fresh `pnpm dev:stack`, `pnpm smoke`, `pnpm seed` ×2, `pnpm test:isolation` — all pass; `ui-consistency:verifying` against Task 10's checklist by a separate agent.
- [ ] **Step 3:** commit `docs: phase 5a`.

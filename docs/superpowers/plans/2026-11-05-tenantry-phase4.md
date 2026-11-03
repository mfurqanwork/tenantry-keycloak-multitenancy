# Tenantry Phase 4: Customer applications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enterprise owners and admins register their own OIDC apps in their realm from the portal, get connection details (a secret once), test the sign-in, rotate, edit and delete; a sample Express app shares single sign-on with our products.

**Architecture:** Postgres `tenant_apps` (forced RLS) is the record; the Keycloak client is written inside the row's transaction through a new `RealmApps` port in `packages/keycloak-admin`, using the realm's `tenantry-backend` credential. Customer clients carry no role scope, and the guard accepts enterprise tokens only from our own two apps. The portal gets list, wizard, detail and test-callback pages built from `@tenantry/ui` patterns.

**Tech Stack:** NestJS 11, Drizzle + Postgres 17, Keycloak 26.8.1 admin REST, React 19 + Carbon 11, `oidc-client-ts` (inside `packages/oidc-client` only), Express 5 + `openid-client` 6 (example only), Vitest, Node test runner for `scripts/`.

**Spec:** `docs/superpowers/specs/2026-11-05-tenantry-phase4-design.md`

## Global Constraints

- AGENTS.md hard rules 1–7 and UI rules apply to every task; Conventional Commits; no attribution lines in commits.
- App types exactly `web`, `spa`, `native`, `m2m`. No SAML.
- Client ids `app-<8 lower-case hex>`; every customer client has attribute `tenantry.app` = `true`, `fullScopeAllowed: false`, no role scope mappings, `implicitFlowEnabled: false`, `directAccessGrantsEnabled: false`, `frontchannelLogout: false`.
- URI rules: `https://` with a host; `http://127.0.0.1[:port]` and `http://[::1][:port]`; `native` also a private-use scheme containing a dot. Refused: other `http`, `localhost` names (message `Use 127.0.0.1 instead of localhost.`), `*` in the host, a fragment, more than 10 per list. Web origins are scheme + host + port only.
- Cap: `TENANTRY_MAX_APPS_PER_TENANT`, default 20; the next registration answers 409 `This workspace has the most apps allowed (20).`
- Standard workspace: 404 `Applications are available on Enterprise workspaces.`
- Secrets are never stored, logged or put in audit metadata. Register (`web`, `m2m`) and rotate return `clientSecret` once.
- Audit actions: `app.registered`, `app.updated`, `app.secret_rotated`, `app.deleted`, `app.token_checked`, metadata `{ name, clientId }` (plus `{ ok }` for token checks, `via: 'ops'` for operator calls).
- Test sign-in redirect: `<portal origin>/applications/test-callback`, added to `web`, `spa`, `native` clients only, never stored in `tenant_apps.redirect_uris`.
- Example app on `http://127.0.0.1:4000`, redirect `http://127.0.0.1:4000/callback` (the spec's `localhost:4000` becomes `127.0.0.1:4000` by the spec's own loopback rule).
- Before the first portal task is handed out, run `ui-consistency:finding-patterns` for the three pages and keep its checklist with the plan workspace.

## Review Focus

1. Keycloak refuses a URI our schema accepted → 400 with Keycloak's reason, no row left (Task 6 test `keycloak refusal leaves no row`).
2. Two registrations at 19 apps at once → exactly one succeeds (Task 6 test `the cap holds under concurrent registrations`).
3. Duplicate or space-padded URIs in a list → trimmed and de-duplicated before any check (Task 1 test `trims and de-duplicates`).
4. Editing or rotating an app whose client was deleted by hand in Keycloak → 409 `This app's client no longer exists in Keycloak. Delete the app.` (Task 7 test `missing client`).
5. Test-callback opened with an unknown or used state → `This test sign-in has expired. Start it again.` and nothing else (Task 12 test `stale state`).

---

### Task 1: App types and URI rules (`packages/auth`)

**Files:**

- Create: `packages/auth/src/apps.ts`, `packages/auth/src/apps.test.ts`
- Modify: `packages/auth/src/index.ts` (export)

**Interfaces:**

- Produces:
  - `type AppType = 'web' | 'spa' | 'native' | 'm2m'`; `const APP_TYPES: readonly AppType[]`
  - `const APP_LIMITS = { uris: 10, nameMax: 80 }`
  - `userSignIn(type: AppType): boolean` (true for `web`, `spa`, `native`)
  - `confidential(type: AppType): boolean` (true for `web`, `m2m`)
  - `normaliseUris(list: string[]): string[]` — trim, drop empty, de-duplicate, keep order
  - `uriProblem(uri: string, kind: 'redirect' | 'origin', type: AppType): string | null` — message or null

- [ ] **Step 1: Write the failing tests** in `apps.test.ts`: `it.each` over accept cases (`https://hr.initech.com/callback`, `https://hr.initech.com:8443/cb`, `http://127.0.0.1:4000/callback`, `http://[::1]:7000/cb`, and for `native` `com.initech.hr:/callback`) and refuse cases with exact messages: `http://hr.initech.com/cb` → `Use https (http only for 127.0.0.1 or [::1]).`; `http://localhost:4000/cb` → `Use 127.0.0.1 instead of localhost.`; `https://*.initech.com/cb` → `No wildcards in the host.`; `https://hr.initech.com/cb#x` → `No fragment (#) in a redirect URI.`; `com.initech.hr:/cb` for `spa` → `Custom schemes are for mobile and desktop apps.`; `myapp:/cb` for `native` → `A custom scheme needs a dot, like com.example.app.`; `not a uri` → `Enter a full URI.`; origin `https://hr.initech.com/path` → `An origin has no path.`. Plus `trims and de-duplicates`: `normaliseUris([' https://a.test/cb ', 'https://a.test/cb', ''])` → `['https://a.test/cb']`.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/auth test` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** with `URL` parsing only (no new dependency; `packages/auth` stays dependency-free).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(auth): app types and redirect URI rules`.

### Task 2: `tenant_apps` table (`packages/db`)

**Files:**

- Create: `packages/db/migrations/0003_phase4.sql` (+ drizzle meta), `packages/db/src/schema/tenant-apps.ts`, `packages/db/src/repositories/apps.ts`, `packages/db/test-integration/phase4.itest.ts`
- Modify: `packages/db/src/schema/index.ts`, `packages/db/src/index.ts`, `packages/db/test-integration/repositories.itest.ts`

**Interfaces:**

- Consumes: `AppType` (Task 1).
- Produces (all take `tx: TenantTx`):
  - `interface AppRecord { id; clientId; kcClientUuid; name; type: AppType; redirectUris: string[]; postLogoutRedirectUris: string[]; webOrigins: string[]; createdBy: string; createdAt: Date; updatedAt: Date }`
  - `createApp(tx, input: Omit<AppRecord,'id'|'createdAt'|'updatedAt'>): Promise<AppRecord>`
  - `listApps(tx): Promise<AppRecord[]>` (newest first), `getApp(tx, id): Promise<AppRecord | null>` (null for a non-uuid id too), `countApps(tx): Promise<number>`
  - `updateApp(tx, id, patch: Pick<AppRecord,'name'|'redirectUris'|'postLogoutRedirectUris'|'webOrigins'>): Promise<AppRecord | null>`
  - `deleteApp(tx, id): Promise<boolean>`
  - `lockTenantApps(tx): Promise<void>` (advisory xact lock on `'apps:' || app.tenant_id`, same shape as `lockTenantMembership`)

- [ ] **Step 1: Write the failing tests**: in `phase4.itest.ts`, `guarantee: tenant_apps is isolated` in the same style as `phase2.itest.ts` (a row in tenant A is invisible and unwritable from tenant B; no tenant set → nothing). In `repositories.itest.ts`: create → list/get/count → update → delete round trip; `client_id` unique per tenant (second insert of the same id rejects); `getApp(tx, 'nope')` → null.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/db test:isolation` — Expected: FAIL (table missing).
- [ ] **Step 3: Implement** the migration (table as in the spec's Data model; `type` check constraint; `unique (tenant_id, client_id)`; `ENABLE` + `FORCE ROW LEVEL SECURITY`; policy `tenant_isolation` identical to `tenant_idps`), schema and repository.
- [ ] **Step 4: Run** the same command — Expected: PASS, including the existing suites.
- [ ] **Step 5: Commit** `feat(db): tenant_apps with forced row-level security`.

### Task 3: `RealmApps` port, HTTP client and fake (`packages/keycloak-admin`)

**Files:**

- Create: `src/realms/app-clients.ts` (+ `.test.ts`), `src/realms/realm-apps.ts`, `src/testing/in-memory-realm-apps.ts`, `src/testing/apps-contract.ts`, `test-integration/realm-apps.itest.ts`
- Modify: `src/index.ts`, `src/testing/index.ts`, `src/in-memory.test.ts` (runs the contract on the fake)

**Interfaces:**

- Consumes: `AppType`, `userSignIn`, `confidential` (Task 1); `createAdminTokenSource`, `DirectoryError`, `BACKEND_CLIENT`.
- Produces:
  - `interface AppClientSpec { name: string; type: AppType; redirectUris: string[]; postLogoutRedirectUris: string[]; webOrigins: string[] }`
  - `appClientRepresentation(clientId: string, spec: AppClientSpec): Record<string, unknown>` — pure; per type as the spec's "Client per type" row; `attributes['post.logout.redirect.uris']` joined with `##`; `attributes['tenantry.app'] = 'true'`; `spa`/`native` add `attributes['pkce.code.challenge.method'] = 'S256'`; `spa` web origins default to the redirect URIs' origins.
  - `newAppClientId(): string` → `app-` + 8 hex.
  - `interface RealmApps { create(clientId, spec): Promise<{ kcClientUuid: string; secret: string | null }>; update(kcClientUuid, spec): Promise<void>; rotateSecret(kcClientUuid): Promise<string>; remove(kcClientUuid): Promise<void>; checkClientCredentials(clientId, secret): Promise<{ ok: true } | { ok: false; error: string }> }`
  - `class AppClientMissingError extends Error` (thrown by `update`/`rotateSecret` on 404); `remove` treats 404 as done; a client without `tenantry.app=true` → `DirectoryError(op, 403, 'not a customer app')`; Keycloak 400 → `DirectoryError` with status 400 and Keycloak's `error_description` as `detail`.
  - `createRealmApps(o: { baseUrl: string; realm: string; clientSecret: string; fetch?: typeof fetch }): RealmApps`
  - `class InMemoryRealmApps implements RealmApps` with `clients: Map<string, { clientId; spec; secret: string | null; attributes }>` and `failNext(status: number, detail: string)` for tests.
  - `runRealmAppsContract(name, make: () => Promise<{ apps: RealmApps; productClientUuid: string; cleanup(): Promise<void> }>)`

- [ ] **Step 1: Write the failing tests**: `app-clients.test.ts` — one test per type asserting `publicClient`, `standardFlowEnabled`, `serviceAccountsEnabled`, `fullScopeAllowed: false`, PKCE attribute, and no `secret` key. `apps-contract.ts` — creates each type (secret present only for `web`/`m2m`); `checkClientCredentials` ok for an `m2m` with its secret, `{ ok: false }` with a wrong one; `rotateSecret` → old secret fails, new works; `update` changes redirect URIs; `remove` twice succeeds; `update(productClientUuid)` rejects with status 403; `update` of a removed client rejects with `AppClientMissingError`.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/keycloak-admin test` then `test:isolation` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the representation, HTTP client (`POST /clients`, read `Location`; `GET /clients/{id}/client-secret`; `POST /clients/{id}/client-secret` for rotation; token check `POST /realms/{realm}/protocol/openid-connect/token` with `grant_type=client_credentials`) and the fake. The real contract run provisions a throwaway realm the way `realm-members.itest.ts` does and passes `tenantry-web`'s uuid as `productClientUuid`.
- [ ] **Step 4: Run** both commands — Expected: PASS for fake and Keycloak.
- [ ] **Step 5: Commit** `feat(keycloak-admin): realm apps for customer clients`.

### Task 4: Realm template v2

**Files:**

- Create: `packages/keycloak-admin/templates/enterprise-realm.v2.json`
- Modify: `src/realms/templates.ts` (`TEMPLATE_VERSION = 2`), `src/realms/templates.test.ts`, `scripts/lib/realm.test.mjs` (reads v2), `test-integration/provisioner.itest.ts`

**Interfaces:**

- Consumes: `loadRealmTemplate`, `withoutRedirectEnforcer` (existing).
- Produces: `TEMPLATE_VERSION === 2`; v1 file stays for history.

- [ ] **Step 1: Write the failing tests**: `templates.test.ts` — v2 over https has `secure-redirect-uris-enforcer` in the profile used by the `any-client` policy with `allow-private-use-uri-scheme: true`, `allow-loopback-interface: true`, `allow-http-scheme: false`; the public profile keeps only `pkce-enforcer`; over http the enforcer is absent everywhere. `realm.test.mjs` updated to the same shape. `provisioner.itest.ts`: `a realm on template v2 over https refuses a wildcard and an http redirect` — apply the template with `allowHttpRedirects: false` to a throwaway realm, then `POST /clients` with `https://*.example.com/cb` and with `http://example.com/cb` each → 400.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/keycloak-admin test`, `pnpm test:scripts`, `pnpm --filter @tenantry/keycloak-admin test:isolation` — Expected: FAIL.
- [ ] **Step 3: Implement** v2 (copy v1, move the enforcer into `tenantry-all-clients`, set the two flags) and bump the version.
- [ ] **Step 4: Run** the three commands — Expected: PASS.
- [ ] **Step 5: Commit** `feat(keycloak-admin): realm template v2 checks redirect URIs on every client`.

### Task 5: Guard accepts enterprise tokens only from our apps; `/api/me` carries the tier

**Files:**

- Modify: `apps/api/src/auth/tenant-auth.guard.ts`, `apps/api/src/modules/tenants/tenants.controller.ts`, `packages/app-kit/src/me.tsx`, related tests (`apps/api/src/auth/*.itest.ts` or the enterprise guard itest, `packages/app-kit` me test)

**Interfaces:**

- Produces: `GET /api/me` → `tenant: { slug, name, tier: 'standard' | 'enterprise' }`; `Me['tenant']['tier']`.

- [ ] **Step 1: Write the failing tests**: an enterprise token with `azp: 'app-1a2b3c4d'` (and every other claim valid) → 401; `azp: 'tenantry-portal'` → 200; `/api/me` on an enterprise tenant returns `tier: 'enterprise'`.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/api test:isolation -- guard` — Expected: FAIL.
- [ ] **Step 3: Implement**: in the enterprise branch after `verify`, reject `azp` not in `['tenantry-web', 'tenantry-portal']` with `UnauthorizedProblem`.
- [ ] **Step 4: Run** the API unit and integration suites — Expected: PASS.
- [ ] **Step 5: Commit** `fix(api): enterprise workspaces accept tokens from our own apps only`.

### Task 6: Apps module — list, get, register

**Files:**

- Create: `apps/api/src/infrastructure/realm-apps.ts`, `apps/api/src/modules/apps/{apps.module,apps.controller,apps.service,apps.schemas}.ts`, `apps.schemas.test.ts`, `apps.itest.ts`
- Modify: `infrastructure.module.ts`, `tokens.ts` (`REALM_APPS`), `config/config.ts` (+ test, `.env.example` `TENANTRY_MAX_APPS_PER_TENANT=20`), `app.module.ts`, `testing/test-app.ts` (`realmApps(realm): InMemoryRealmApps`)

**Interfaces:**

- Consumes: Tasks 1–3; `backendSecretKey`, `SecretStore`, `AuditService`, `tenantOrigin`.
- Produces:
  - `interface RealmAppsFactory { forTenant(tenant: TenantRecord): Promise<RealmApps> }` (enterprise only; same secret lookup and per-realm cache as `createMemberDirectories`)
  - `appBody` (Zod): `{ name: 1–80 trimmed, type: AppType, redirectUris, postLogoutRedirectUris, webOrigins }` using `normaliseUris` + `uriProblem` with field paths like `redirectUris.1`; `m2m` requires empty URI lists; `web`/`spa`/`native` require at least one redirect URI.
  - `AppView = AppRecord & { connection: { issuer, discoveryUrl, authorizationEndpoint, tokenEndpoint, jwksUri, endSessionEndpoint, clientId, scopes: 'openid profile email', testRedirectUri: string | null } }`
  - `AppsService.list(ctx, tenant)`, `get(ctx, tenant, id)`, `register(ctx, tenant, body, actor: { userId: string | null; via?: 'ops' }) → { app: AppView; clientSecret?: string }`
  - Routes: `GET /api/apps`, `GET /api/apps/:id` (`apps:read`), `POST /api/apps` (`apps:register`).

- [ ] **Step 1: Write the failing tests** in `apps.itest.ts` (enterprise tenant from `seedEnterpriseTenant`, owner/admin/member tokens via `enterpriseToken`): register `web` → 201, `clientSecret` present, row has no secret column (`select * from tenant_apps` keys), audit `app.registered` with `{ name, clientId }` and no `clientSecret` anywhere in metadata; Keycloak client has the test redirect URI but the row doesn't; register `spa` → no `clientSecret`; member → 403; Standard tenant → 404 with the exact sentence; another tenant's app id → 404; `keycloak refusal leaves no row` (`realmApps(realm).failNext(400, 'Invalid Redirect Uri')` → 400 whose detail contains `Invalid Redirect Uri`, `listApps` empty); cap: with `TENANTRY_MAX_APPS_PER_TENANT=2`, the third → 409 exact message; `the cap holds under concurrent registrations` (at cap − 1, two parallel registrations → one 201, one 409). `apps.schemas.test.ts`: field paths and the m2m/redirect requirements.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/api test` and `test:isolation` — Expected: FAIL.
- [ ] **Step 3: Implement**: register runs in `tenantTx` with `lockTenantApps`, `countApps`, `createApp`, then `realmApps.create`, then audit; on Keycloak `DirectoryError` with status 400 → `ValidationProblem` carrying Keycloak's detail; if the transaction throws after `create` succeeded, call `realmApps.remove` and rethrow.
- [ ] **Step 4: Run** both suites — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): register and list customer apps`.

### Task 7: Apps module — edit, rotate, token check, delete

**Files:**

- Modify: `apps.controller.ts`, `apps.service.ts`, `apps.schemas.ts`, `apps.itest.ts`

**Interfaces:**

- Produces: `PATCH /api/apps/:id` (body = `appBody` without `type`), `POST /api/apps/:id/secret` → `{ clientSecret }`, `POST /api/apps/:id/token-check` (body `{ clientSecret: string }`) → `{ ok: boolean; error?: string }`, `DELETE /api/apps/:id` → 204; service methods `update`, `rotateSecret`, `checkToken`, `remove` with the same `actor` parameter as `register`.

- [ ] **Step 1: Write the failing tests**: edit changes the row and the Keycloak client (still including the test redirect URI), audit `app.updated`; rotate on `web` returns a new secret and the old one fails `checkClientCredentials`, audit `app.secret_rotated` without the secret; rotate on `spa` → 409 `This app has no secret (public client).`; token-check on `m2m` ok and wrong-secret `{ ok: false }`, audit `app.token_checked` with `{ ok }` and no secret; token-check on `web` → 409 `Token checks are for machine-to-machine apps.`; delete → 204, row gone, client gone, audit `app.deleted`; delete when the client is already gone → 204; `missing client` (remove the client from the fake, then PATCH and rotate) → 409 with the exact Review Focus message; member → 403 on all four.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/api test:isolation -- apps` — Expected: FAIL.
- [ ] **Step 3: Implement** (Keycloak first, then row and audit, one transaction; delete: Keycloak then row).
- [ ] **Step 4: Run** API unit + integration suites — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): edit, rotate, check and delete customer apps`.

### Task 8: Operator app commands and the seed

**Files:**

- Modify: `apps/api/src/modules/enterprise/enterprise.controller.ts` (+ itest), `apps/ops/src/cli.ts`, `apps/ops/src/seed/seed.ts`, `.gitignore` (`examples/customer-app/.env`)
- Create: `apps/ops/src/commands/apps.ts` (+ `apps.test.ts`)

**Interfaces:**

- Consumes: `AppsService` (exported by `AppsModule`, imported by `EnterpriseModule`).
- Produces: operator routes `GET /api/platform/enterprise-tenants/:slug/apps`, `POST /api/platform/enterprise-tenants/:slug/apps`, `POST /api/platform/enterprise-tenants/:slug/apps/:id/secret` (all `@OperatorOnly()`, audit `via: 'ops'`); `pnpm ops apps list --tenant <slug>`, `pnpm ops apps register --tenant <slug> --name <n> --type <t> --redirect <uri>...`, `pnpm ops apps rotate --tenant <slug> --app <id>`; the CLI prints secrets only for `register`/`rotate`, to stdout.

Ruling recorded here: the spec has the seed register "Initech HR" "through the API", but an enterprise realm refuses the password grant, so the seed has no owner token. The seed uses these operator routes instead (same `AppsService`, audited `via: 'ops'`).

- [ ] **Step 1: Write the failing tests**: operator register/list/rotate itest (operator token → 201/200; tenant token → 401; unknown slug → 404); `apps.test.ts` for argument parsing and output; seed unit test (fake deps): first run runs `enterprise upgrade` for Initech, registers `Initech HR` (`web`, redirect `http://127.0.0.1:4000/callback`, post-logout `http://127.0.0.1:4000/`) and writes `examples/customer-app/.env` with `ISSUER`, `CLIENT_ID`, `CLIENT_SECRET`, `AUTH_INTERNAL_URL`; second run changes nothing; app present but `.env` missing → rotates and rewrites the file; the secret never appears in the seed's printed output.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/ops test`, `pnpm --filter @tenantry/api test:isolation -- enterprise` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** both, then on the stack `pnpm seed` twice — Expected: PASS; second seed prints `The demo is already seeded: nothing to change.`
- [ ] **Step 5: Commit** `feat(ops): app commands; the seed registers Initech HR`.

### Task 9: Test sign-in helper (`packages/oidc-client`)

**Files:**

- Create: `packages/oidc-client/src/test-login.ts` (+ `.test.ts`)
- Modify: `packages/oidc-client/src/index.ts`

**Interfaces:**

- Produces:
  - `startTestLogin(o: { authority: string; clientId: string; redirectUri: string; appId: string; exchange: boolean }): Promise<void>` — PKCE request via `oidc-client-ts` `OidcClient` with a `sessionStorage` state store, then `window.location.assign`
  - `finishTestLogin(url: string): Promise<TestLoginResult>` where `type TestLoginResult = { kind: 'claims'; appId; claims: { iss; sub; aud; exp } } | { kind: 'signed-in'; appId } | { kind: 'error'; appId: string | null; error: string; description: string | null } | { kind: 'expired' }`

- [ ] **Step 1: Write the failing tests** (fake `fetch` for the token endpoint): exchange → `claims`; `exchange: false` with a `code` → `signed-in` and no token request; `?error=access_denied&error_description=...` → `error`; unknown state → `expired`; a state cannot be used twice.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/oidc-client test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(oidc-client): test sign-in for customer apps`.

### Task 10: Portal — Applications list (UI checklist first)

**Files:**

- Create: `apps/portal/src/features/applications/ApplicationsRoute.tsx` (+ test), `apps/portal/src/features/applications/api.ts` (typed calls)
- Modify: `apps/portal/src/App.tsx` (nav `Applications`, `needs: 'apps:read'`; routes)

**Interfaces:**

- Consumes: `GET /api/apps`, `Me.tenant.tier`, `ListPage`, `useResource`, `ApiErrorNotification`.
- Produces: routes `/applications`, `/applications/new`, `/applications/:id`, `/applications/test-callback` (the last three filled by Tasks 11–12).

- [ ] **Step 0: Run `ui-consistency:finding-patterns`** for the list, wizard and detail pages (reference: web `MembersRoute` for the list, portal `BrandingRoute` for settings-like forms) and save the checklist in the plan workspace; Tasks 10–12 follow it.
- [ ] **Step 1: Write the failing tests**: Standard tier shows `Applications are available on Enterprise workspaces.` and no table; enterprise shows a table with name, type label (`Web app`, `Single-page app`, `Mobile or desktop app`, `Machine to machine`), client id; empty state with `Register an app` for `apps:register`, without it for members.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/portal test` — Expected: FAIL.
- [ ] **Step 3: Implement** from `ListPage`.
- [ ] **Step 4: Run** — Expected: PASS; `pnpm --filter @tenantry/portal lint` passes stylelint.
- [ ] **Step 5: Commit** `feat(portal): applications list`.

### Task 11: Portal — register wizard

**Files:**

- Create: `apps/portal/src/features/applications/RegisterAppRoute.tsx` (+ test), `UriListField.tsx`

**Interfaces:**

- Consumes: `POST /api/apps`, `uriProblem`, `normaliseUris`, `APP_TYPES`, `WizardPage`.
- Produces: on success, navigates to `/applications/:id` with the secret in router state only (`{ clientSecret }`), never storage.

- [ ] **Step 1: Write the failing tests**: steps `Type` → `Details` → `Review`; inline URI errors use `uriProblem` messages; `m2m` hides URI fields; API 400 field errors show on their fields; 409 cap shows the API's message; submit navigates with `state.clientSecret`.
- [ ] **Step 2–4:** run `pnpm --filter @tenantry/portal test` (FAIL → implement from `WizardPage` → PASS).
- [ ] **Step 5: Commit** `feat(portal): register an app`.

### Task 12: Portal — app detail, snippets, test sign-in

**Files:**

- Create: `AppDetailRoute.tsx` (+ test), `snippets.ts` (+ test), `TestCallbackRoute.tsx` (+ test), `EditAppDialog.tsx`, `DeleteAppDialog.tsx`

**Interfaces:**

- Consumes: `GET/PATCH/DELETE /api/apps/:id`, `POST .../secret`, `POST .../token-check`, `startTestLogin`, `finishTestLogin`, `DetailPage`, `FormDialog`.
- Produces: `snippetsFor(app: AppView, secretPlaceholder = '<your client secret>'): { label: string; language: 'javascript' | 'bash'; code: string }[]` — `web`: Node `openid-client`; `spa`: `oidc-client-ts`; `m2m`: Node `openid-client` client credentials and `curl`; `native`: none.

- [ ] **Step 1: Write the failing tests**: connection table rows from the spec; secret from router state shown once in a notification with copy, gone after re-render without state; `snippets.test.ts` — each snippet contains the app's issuer and client id and never a real secret; rotate asks to confirm, then shows the new secret once; delete needs the exact name typed; `Test sign-in` calls `startTestLogin` with `exchange` true for `spa`/`native`, false for `web`; `m2m` shows `Request a token` with a password field and reports ok/error; `TestCallbackRoute` renders claims, signed-in (`Keycloak signed you in (<email>) for this app.`), error, and `stale state` → `This test sign-in has expired. Start it again.`
- [ ] **Step 2–4:** run `pnpm --filter @tenantry/portal test` (FAIL → implement → PASS).
- [ ] **Step 5: Commit** `feat(portal): app connection details, snippets and test sign-in`.

### Task 13: `examples/customer-app`

**Files:**

- Create: `examples/customer-app/{package.json,tsconfig.json,src/server.ts,src/config.ts,src/config.test.ts,README.md,.env.example}`
- Modify: `pnpm-workspace.yaml` (`examples/*`), root `package.json` (`example:customer-app`)

**Interfaces:**

- Produces: `loadConfig(env): { issuer: string; clientId: string; clientSecret: string; authInternalUrl: string | null; port: 4000 }`; server routes `/` (signed-in email or a `Sign in` link), `/login`, `/callback`, `/logout` (RP-initiated logout with `post_logout_redirect_uri=http://127.0.0.1:4000/`); `openid-client` `customFetch` rewrites the issuer's origin to `AUTH_INTERNAL_URL` when set.

- [ ] **Step 1: Write the failing test** `config.test.ts`: missing `CLIENT_SECRET` → throws `Set CLIENT_SECRET (pnpm seed writes examples/customer-app/.env).`; full env → config.
- [ ] **Step 2–4:** `pnpm --filter @tenantry/customer-app test` (FAIL → implement → PASS); manual: `pnpm example:customer-app` starts on `http://127.0.0.1:4000`.
- [ ] **Step 5: Commit** `feat(examples): customer app with openid-client`.

### Task 14: Isolation guarantees

**Files:**

- Create: `tests/isolation/src/phase4.test.ts`
- Modify: `tests/isolation/src/helpers/browser-flow.ts` (`signInWithBrowser` takes optional `browser: Browser`), `README.md` (Phase 4 rows → `tested`, new row)

**Interfaces:**

- Consumes: Initech (seeded), owner via `signInWithBrowser`, Task 8 operator routes, Task 13 example app (spawned with `node`).

- [ ] **Step 1: Write the tests**: (1) API refuses `https://*.x.test/cb`, `http://x.test/cb`, `http://localhost:4000/cb` (400); (2) an acme admin's token on Initech's host `POST /api/apps` → 401, and an Initech owner's token on acme's host → 401; an Initech app id requested on another enterprise tenant's host with its owner token → 404; (3) a corp-demo/platform user cannot complete sign-in to Initech HR (login fails: no such user); (4) a client-credentials token of an `m2m` app on `/api/me` → 401; (5) portal sign-in, then opening the example app signs in with no login form and shows the owner's email; logout there, then the portal's authorization request shows the login form.
- [ ] **Step 2: Run** `pnpm test:isolation` against a freshly seeded stack — Expected: new tests PASS (they exercise Tasks 1–13; a failure here is a bug in those tasks).
- [ ] **Step 3: Update README** rows and commit `test: phase 4 guarantees`.

### Task 15: Docs and full gate

**Files:**

- Modify: `docs/decisions/0011-customer-apps.md` (Update (Phase 4)), `docs/known-issues.md`, `CHANGELOG.md`, `AGENTS.md`, `README.md` (status line, phases table)
- Create: `docs/guides/connect-your-app.md`

- [ ] **Step 1: Write the docs**: ADR-0011 update (four types, SAML deferred, loopback only, our-apps-only tokens, template v2, operator app routes); guide per type (what to enter, which connection details, the example app); known issues (SAML; drift from hand edits; consent/scopes; app logos; registration rate limits; test sign-in redirect on every user-login client).
- [ ] **Step 2: Run the gate**: `pnpm lint typecheck test build`, `pnpm test:scripts`, fresh `pnpm dev:stack`, `pnpm smoke`, `pnpm seed` ×2, `pnpm test:isolation` — Expected: all pass. Then the browser walk from the spec (register each type, copy the secret, test sign-in, example app without a login page, rotate, delete; light, dark and 375 px) and `ui-consistency:verifying` against the Task 10 checklist.
- [ ] **Step 3: Commit** `docs: phase 4`.

# Tenantry Phase 2 (SSO across apps, branding, company login → v0.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One sign-in opens both apps, workspaces switch from the header, logout in one app ends both, each tenant's logo and colour show in the apps and on the Keycloak login page, and operators link a company IdP after DNS proves the domain. The result is tagged `v0.1.0`.

**Architecture:** Keycloak's SSO session is the only shared state between `apps/web` and `apps/portal`; each app keeps its own tokens and checks the session by refreshing. Branding is stored per tenant (colour in `tenants.branding`, logo bytes in `tenant_logos` under RLS) and turned into Carbon tokens by the dependency-free `@tenantry/brand` package, which the API, both apps and the Keycloakify login theme share. Company login is operator-only: an `apps/ops` CLI writes `tenant_domains` / `tenant_idps` through `@tenantry/db` and creates the IdP only through `@tenantry/keycloak-admin`.

**Tech Stack:** Keycloak 26.8.1 Organizations; Keycloakify 11 (Maven 3.9 + JDK 17+ on the host; a Maven build stage in Docker); NestJS 11 with multer from `@nestjs/platform-express`; Drizzle + Postgres 17 RLS; React 19, react-router 7, `@carbon/react` 11; CoreDNS 1.12; Node `dns/promises`; Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-02-tenantry-phase2-design.md`. Known issues: `docs/known-issues.md`.

## Global Constraints

- AGENTS.md hard rules 1–7 hold for every task: tenant tables only inside `tenantTx`; Keycloak admin calls only in `packages/keycloak-admin`; permissions checked with `@RequirePermission`, never role names; every identity change audited; every new tenant table or endpoint gets an isolation test.
- Logo: PNG, JPEG or WebP, at most 256 KB (262144 bytes), type checked by magic bytes, never by the client's content type.
- Colour: `#rrggbb` only; must reach 4.5:1 contrast with `#ffffff`; otherwise 422 with `suggestion`, the nearest darker shade that does.
- Portal host: `<slug>.portal.<base domain>`, Keycloak client `tenantry-portal`; web host `<slug>.<base domain>`, client `tenantry-web`.
- Ports and names from `.env`: Caddy `TENANTRY_HTTP_PORT`, Keycloak loopback `TENANTRY_KC_PORT`, CoreDNS `127.0.0.1:1053` (`TENANTRY_DNS_SERVER=127.0.0.1:1053`), `SEED_PASSWORD`.
- TXT record: name `_tenantry-verify.<domain>`, value `tenantry-verify=<token>`; token = 32 random bytes, base64url.
- New audit actions: `branding.updated`, `branding.logo_updated`, `branding.logo_removed`, `member.left`, `domain.claimed`, `domain.verified`, `idp.linked`.
- UI: every screen from a `@tenantry/ui` page pattern; Carbon components and `@carbon/icons-react` only; tokens, no raw sizes. Header stays `g100`; `applyBrand` changes the page body only.
- ESM `.js` specifiers, TypeScript strict, tests beside code (`*.test.ts(x)`, `*.itest.ts`), Conventional Commits, no attribution lines in commits.
- No push, no merge, no tag push. The `v0.1.0` tag is created locally only after the person merges.
- After each task, strike or add rows in `docs/known-issues.md` when the task fixes or reveals something.

## Review Focus

1. **Login page after a failed password.** Keycloak re-renders the login page at `login-actions/authenticate` without `redirect_uri`; the theme must still show the tenant's brand from `sessionStorage`, and a tab that never saw a tenant must show the Tenantry brand. Test in Task 12.
2. **Two tabs of the same app after logout elsewhere.** Both tabs must reach the login page on focus, and neither may loop between `/auth/callback` and Keycloak. Test in Task 9 (a refresh failure clears the user exactly once and starts one sign-in).
3. **A logo whose bytes lie.** An SVG or HTML file renamed `.png` with `content-type: image/png` must be refused with 422; a 262145-byte PNG must be refused with 413. Tests in Task 7.
4. **Domain verified by another tenant.** `globex` claiming and verifying `acme.test` after `acme` verified it must fail without leaking that `acme` holds it beyond "already verified by another workspace". Test in Task 13.
5. **Portal host for a slug that is not active.** `ghost.portal.tenantry.localhost` must answer 404 on `auth-config`, exactly like the web host, and `portal.tenantry.localhost` (no slug) must not resolve to a tenant called `portal`. Tests in Task 5.

---

## File Structure

```
apps/login-theme/            Keycloakify 11 theme "tenantry" → dist_keycloak/tenantry-login-theme.jar
  src/login/KcPage.tsx         routes Keycloak pages; Login page in Carbon
  src/login/tenant-brand.ts    reads redirect_uri / sessionStorage, fetches branding
infra/keycloak/Dockerfile    stage 1 builds the JAR with Maven; stage 2 = keycloak:26.8.1 + JAR
infra/keycloak/corp-demo-realm.json   stand-in company IdP
infra/dns/Corefile           CoreDNS: zone "test." from /zones/test.db, reload 2s
packages/brand/              parseHex, contrastRatio, meetsContrast, darkerUntilContrast, brandTokens
packages/app-kit/            moved from apps/web/src/lib: api, ApiErrorNotification, FormDialog, RouterLink,
                             SignedInApi, me, useResource, roles; plus TenantAuth (the TenantApp shell logic)
packages/ui/src/brand.ts     applyBrand(tokens) implemented
packages/ui/src/shell/       AppSwitcher, WorkspaceSwitcher, used by AppShell
packages/db/migrations/0002_phase2.sql   tenant_logos, tenant_domains, tenant_idps + RLS
packages/db/src/repositories/branding.ts, domains.ts
packages/keycloak-admin/     listUserOrganizations, client-specific origins, addOrganizationDomain,
                             createOidcIdentityProvider, linkIdentityProvider, dev/seed users
apps/api/src/modules/branding/, workspaces/; members leave; tenants auth-config per app
apps/ops/                    CLI: seed, domain claim|verify, idp link, dns set-txt, tenants sync-origins
apps/portal/src/features/    dashboard, branding (SettingsPage)
tests/isolation/src/phase2.test.ts
docs/decisions/0020-single-logout-session-check.md, 0021-keycloakify-login-theme.md, 0022-company-idp-by-operator.md
docs/demo-script.md, CHANGELOG.md
```

---

### Task 1: Login-theme spike — Keycloakify JAR loaded by Keycloak

The risk task. If the JAR cannot be built in Docker or Keycloak does not load it, stop and report to the person; do not switch to a plain FreeMarker theme on your own.

**Files:**
- Create: `apps/login-theme/{package.json,vite.config.ts,tsconfig.json,index.html,src/main.tsx,src/kc.gen.tsx,src/login/KcPage.tsx,src/login/KcContext.ts,src/login/pages/Login.tsx,src/login/login.scss}`
- Create: `infra/keycloak/Dockerfile`
- Modify: `infra/docker-compose.yml` (keycloak `build:` instead of `image:`), `infra/keycloak/platform-realm.json` (`"loginTheme": "tenantry"`), `scripts/lib/realm.test.mjs`, `scripts/lib/compose.test.mjs`, `scripts/smoke.mjs`, `.gitignore` (`dist_keycloak/`), `turbo.json` (`build` outputs include `dist_keycloak/**`)

**Interfaces:**
- Produces: package `@tenantry/login-theme`; script `build` = `vite build`; script `build:jar` = `keycloakify build`; JAR path `apps/login-theme/dist_keycloak/tenantry-login-theme.jar`; theme name `tenantry`; marker attribute `data-tenantry-theme` on the login page's root element.

- [ ] **Step 1: Write the failing tests** in `scripts/lib/realm.test.mjs` and `scripts/lib/compose.test.mjs`

```js
test('the platform realm uses the tenantry login theme', () => {
  assert.equal(realm.loginTheme, 'tenantry');
});
// compose.test.mjs
test('keycloak is built from infra/keycloak/Dockerfile so the theme JAR is inside', () => {
  assert.equal(compose.services.keycloak.build.dockerfile, 'infra/keycloak/Dockerfile');
  assert.equal(compose.services.keycloak.image, undefined);
});
```

- [ ] **Step 2: Run** `pnpm test:scripts` — Expected: the two new tests FAIL.
- [ ] **Step 3: Scaffold the theme.** Keycloakify 11.16.x, `keycloakify({ themeName: 'tenantry', accountThemeImplementation: 'none', keycloakVersionTargets: { '22-to-25': false, 'all-other-versions': 'tenantry-login-theme.jar' } })`. `KcPage` renders the Carbon `Login` page for `login.ftl` and Keycloakify's default pages for the rest. `Login.tsx` is a Carbon `Form` + `TextInput` + `PasswordInput` + `Button`, posting to `kcContext.url.loginAction`, with `data-tenantry-theme` on its root. Styles import `@carbon/styles` and `@tenantry/ui` styles; theme `g10`.
- [ ] **Step 4: Build the JAR on the host.** Run: `pnpm --filter @tenantry/login-theme build:jar` — Expected: `dist_keycloak/tenantry-login-theme.jar` exists.
- [ ] **Step 5: Docker image.** `infra/keycloak/Dockerfile`: stage `theme` FROM `node:22-bookworm`, `apt-get install -y --no-install-recommends maven openjdk-17-jdk-headless`, corepack pnpm, `pnpm install --frozen-lockfile --filter "@tenantry/login-theme..."`, `pnpm --filter @tenantry/login-theme build:jar`; final stage FROM `quay.io/keycloak/keycloak:26.8.1`, `COPY --from=theme .../tenantry-login-theme.jar /opt/keycloak/providers/`. Compose keycloak gets `build: { context: .., dockerfile: infra/keycloak/Dockerfile }`. Set `loginTheme` in the realm file, and on the live realm through the admin API (the import does not overwrite an existing realm).
- [ ] **Step 6: Smoke.** Add a check to `scripts/smoke.mjs`: GET the platform realm's auth endpoint for `tenantry-web` with a valid redirect URI; body contains `data-tenantry-theme`. Run `pnpm dev:stack` then `pnpm smoke` — Expected: all checks pass, including the new one. Run `pnpm test:scripts` — Expected: PASS.
- [ ] **Step 7: ADR-0021** `docs/decisions/0021-keycloakify-login-theme.md`: Keycloakify chosen; Maven needed for the JAR (host or Docker stage); fallback if it breaks is a plain theme, decided by the person. Add it to `docs/decisions/README.md`.
- [ ] **Step 8: Commit** `feat: keycloakify login theme built into the keycloak image`

### Task 2: `@tenantry/brand` — colour maths

**Files:**
- Create: `packages/brand/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,src/index.ts,src/color.ts,src/color.test.ts}`

**Interfaces:**
- Produces:
  - `parseHex(hex: string): { r: number; g: number; b: number } | null` — `#rrggbb` only, case-insensitive.
  - `contrastRatio(a: string, b: string): number` — WCAG 2.x relative luminance.
  - `meetsContrast(hex: string, against?: string /* '#ffffff' */, min?: number /* 4.5 */): boolean`
  - `darkerUntilContrast(hex: string, against?: string, min?: number): string` — lowers HSL lightness in steps of 1 % until it passes; returns lowercase `#rrggbb`.
  - `brandTokens(hex: string): BrandTokens` where `BrandTokens = { interactive: string; hover: string; active: string; focus: string; link: string }` — hover = lightness −8 %, active = lightness −16 %, focus = link = interactive.

- [ ] **Step 1: Write the failing tests** in `src/color.test.ts`:

```ts
expect(parseHex('#0F62FE')).toEqual({ r: 15, g: 98, b: 254 });
expect(parseHex('0f62fe')).toBeNull();
expect(parseHex('#fff')).toBeNull();
expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
expect(contrastRatio('#0f62fe', '#ffffff')).toBeCloseTo(4.86, 2);
expect(meetsContrast('#0f62fe')).toBe(true);
expect(meetsContrast('#ffcc00')).toBe(false);
const s = darkerUntilContrast('#ffcc00');
expect(meetsContrast(s)).toBe(true);
expect(meetsContrast(lighten(s, 1))).toBe(false); // nearest: one step lighter fails (test helper in the test file)
expect(darkerUntilContrast('#0f62fe')).toBe('#0f62fe');
expect(brandTokens('#0f62fe')).toMatchObject({ interactive: '#0f62fe', focus: '#0f62fe', link: '#0f62fe' });
expect(contrastRatio(brandTokens('#0f62fe').hover, '#ffffff')).toBeGreaterThan(4.86);
```

- [ ] **Step 2: Run** `pnpm --filter @tenantry/brand test` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** in `src/color.ts`, export from `src/index.ts`. No runtime dependencies.
- [ ] **Step 4: Run** — Expected: PASS. Run `pnpm --filter @tenantry/brand lint typecheck build` — Expected: clean.
- [ ] **Step 5: Commit** `feat(brand): contrast maths and brand tokens`

### Task 3: `@tenantry/ui` — `applyBrand`, app switcher, workspace switcher

**Files:**
- Modify: `packages/ui/src/brand.ts`, `packages/ui/src/shell/AppShell.tsx`, `packages/ui/src/index.ts`, `packages/ui/package.json` (dep `@tenantry/brand`)
- Create: `packages/ui/src/brand.test.ts`, `packages/ui/src/shell/AppSwitcher.tsx`, `packages/ui/src/shell/WorkspaceSwitcher.tsx`, `packages/ui/src/shell/switchers.test.tsx`

**Interfaces:**
- Consumes: `brandTokens`, `BrandTokens` (Task 2).
- Produces:
  - `applyBrand(tokens: BrandTokens | null, target?: HTMLElement /* document.body */): void` — sets or (for null) removes `--cds-interactive`, `--cds-button-primary`, `--cds-button-primary-hover`, `--cds-button-primary-active`, `--cds-link-primary`, `--cds-focus`, `--cds-border-interactive`.
  - `AppShell` new optional props: `apps?: { label: string; href: string; current: boolean }[]`, `workspaces?: { slug: string; name: string; href: string; current: boolean }[]`, `logoUrl?: string | null`.
  - `AppSwitcher` = `HeaderGlobalAction` (`Switcher` icon, label "Switch app") + `HeaderPanel` + Carbon `Switcher`/`SwitcherItem`. `WorkspaceSwitcher` = same with label "Switch workspace", the current workspace marked `isSelected`. Both render nothing with fewer than 2 entries. Links are full page loads (other origins).

- [ ] **Step 1: Write the failing tests:**
  - `brand.test.ts`: `applyBrand(brandTokens('#0f62fe'), el)` sets `el.style.getPropertyValue('--cds-button-primary') === '#0f62fe'`; `applyBrand(null, el)` removes all seven; the header's `g100` zone element is not touched (`applyBrand` writes only on `target`).
  - `switchers.test.tsx`: with 2 workspaces, clicking "Switch workspace" shows both names, the current one `aria-selected`/`isSelected`, and links point to `href`; with 1 workspace, no "Switch workspace" button; same for apps with "Switch app". With `logoUrl`, the header shows `<img alt="">` before the product name.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/ui test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Logo height from a Carbon spacing token in `styles/index.scss` (`.tenantry-header__logo { block-size: $spacing-07 }`), no raw sizes.
- [ ] **Step 4: Run** `pnpm --filter @tenantry/ui test lint typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): applyBrand and the app and workspace switchers`

### Task 4: Migration 0002 and repositories

**Files:**
- Create: `packages/db/migrations/0002_phase2.sql`, `packages/db/src/schema/{tenant-logos.ts,tenant-domains.ts,tenant-idps.ts}`, `packages/db/src/repositories/{branding.ts,domains.ts}`
- Modify: `packages/db/migrations/meta/_journal.json` (idx 2, tag `0002_phase2`), `packages/db/src/schema/index.ts`, `packages/db/src/schema/tenants.ts` (branding type), `packages/db/src/index.ts`, `packages/db/src/repositories/platform.ts`, `packages/db/test-integration/{rls.itest.ts,repositories.itest.ts}`

**Interfaces:**
- Produces:
  - `TenantBranding = { primaryColor: string | null; logoVersion: number | null }`; `TenantRecord.branding: TenantBranding` (missing keys read as null).
  - `platformRepository(db).setBranding(tenantId: string, patch: Partial<TenantBranding>): Promise<TenantBranding>` (jsonb merge); `findActiveTenantsBySlugs(slugs: string[]): Promise<TenantRecord[]>`.
  - `getLogo(tx: TenantTx): Promise<{ contentType: string; bytes: Buffer; updatedAt: Date } | null>`, `putLogo(tx, { contentType, bytes }): Promise<void>` (upsert), `deleteLogo(tx): Promise<boolean>`.
  - `claimDomain(tx, domain): Promise<DomainRecord>` (returns the existing unverified claim with its token if one exists), `findDomain(tx, domain): Promise<DomainRecord | null>`, `markDomainVerified(tx, id): Promise<void>` → throws `DomainTakenError` on the unique violation, `insertIdp(tx, { alias, domainId }): Promise<void>`, `listIdps(tx)`.
  - `DomainRecord = { id: string; domain: string; verificationToken: string; verifiedAt: Date | null }`.
- SQL: `tenant_logos(tenant_id uuid pk default current tenant references tenants, content_type text check in ('image/png','image/jpeg','image/webp'), bytes bytea check octet_length(bytes) <= 262144, updated_at timestamptz default clock_timestamp())`; `tenant_domains(id uuid pk, tenant_id …, domain text check lower(domain)=domain, verification_token text, verified_at timestamptz, created_at …, unique(tenant_id, domain))` + `create unique index tenant_domains_verified on tenant_domains(domain) where verified_at is not null`; `tenant_idps(tenant_id …, alias text unique, domain_id uuid references tenant_domains, created_at …, primary key (tenant_id, alias))`. All three: `enable` + `force row level security`, the Phase 1 policy expression, grants to `tenantry_app` (select, insert, update, delete).

- [ ] **Step 1: Write the failing integration tests:** RLS — each new table returns zero rows for another tenant and refuses an insert with another tenant's id (same shape as the Phase 1 RLS tests); repositories — `putLogo` twice keeps one row; `claimDomain` twice returns the same token; `markDomainVerified` for the same domain in a second tenant throws `DomainTakenError`; `setBranding` merges (`{primaryColor}` then `{logoVersion}` keeps both).
- [ ] **Step 2: Run** `pnpm --filter @tenantry/db test:isolation` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the migration, schema and repositories. `DomainTakenError` in `errors.ts`, detected by Postgres code `23505` on `tenant_domains_verified` through the existing `cause` unwrapping.
- [ ] **Step 4: Run** — Expected: PASS (all database integration tests).
- [ ] **Step 5: Commit** `feat(db): logos, domains and identity providers with row-level security`

### Task 5: Portal host, per-app auth-config and the `tenantry-portal` client

**Files:**
- Modify: `apps/api/src/auth/host.ts`, `host.test.ts`, `apps/api/src/modules/tenants/{tenants.service.ts,tenants.controller.ts,tenants.itest.ts}`, `apps/api/src/modules/signup/{slug.ts,slug.test.ts,signup.saga.ts,signup.itest.ts}`, `infra/keycloak/platform-realm.json`, `scripts/lib/realm.test.mjs`, `packages/keycloak-admin/src/{identity-directory.ts,http-identity-directory.ts,testing/in-memory-identity-directory.ts,testing/contract.ts}`, `apps/api/src/infrastructure/infrastructure.module.ts`

**Interfaces:**
- Produces:
  - `type TenantApp = 'web' | 'portal'`; `tenantFromHost(host, baseDomain): { slug: string; app: TenantApp } | null`; `slugFromHost` kept as `tenantFromHost(...)?.slug ?? null`. `acme.portal.<base>` → `{ slug: 'acme', app: 'portal' }`; `portal.<base>` → null.
  - `tenantOrigin(slug, config, app: TenantApp = 'web')` → `http://acme.portal.tenantry.localhost:8080` for portal.
  - `IdentityDirectory.addTenantOrigin(origin: string, app: TenantApp)` and `removeTenantOrigin(origin, app)`; HTTP directory options gain `portalClientId: 'tenantry-portal'`. `TenantApp` is exported from `@tenantry/auth` so both packages share it.
  - `TenantsService.authConfig(slug, app)` → `clientId` is `tenantry-web` or `tenantry-portal`; controller reads `app` from the Host header (apex or unknown host → `web`).
  - Signup saga registers both origins (two steps with undo).

- [ ] **Step 1: Write the failing tests:** `host.test.ts` (portal host, bare `portal.<base>`, `a.b.portal.<base>` → null, port stripped); `slug.test.ts` (portal origin); `realm.test.mjs` (`tenantry-portal` public PKCE S256, redirect URIs empty, audience mapper `tenantry-api` and group mapper as `tenantry-web`); contract test (`addTenantOrigin(o, 'portal')` adds to the portal client only); `tenants.itest.ts` (auth-config on the portal host returns `clientId: 'tenantry-portal'`; `ghost.portal` host → 404); `signup.itest.ts` (both origins recorded by the fake directory; undo removes both when a later step fails).
- [ ] **Step 2: Run** `pnpm test:scripts` and `pnpm --filter @tenantry/api test` and the contract test — Expected: FAIL.
- [ ] **Step 3: Implement.** Add the `tenantry-portal` client to the realm file and to the live realm through the admin API.
- [ ] **Step 4: Run** unit + `pnpm --filter @tenantry/keycloak-admin test:isolation` + `pnpm --filter @tenantry/api test:isolation` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: portal hosts sign in through tenantry-portal`

### Task 6: Workspaces, leaving a workspace, and 502 for Keycloak outages

**Files:**
- Create: `apps/api/src/modules/workspaces/{workspaces.module.ts,workspaces.controller.ts,workspaces.service.ts,workspaces.itest.ts}`
- Modify: `packages/keycloak-admin` (interface, HTTP, fake, contract), `apps/api/src/modules/members/{members.controller.ts,members.service.ts,members.itest.ts}`, `apps/api/src/common/{problem.filter.ts,problem.filter.test.ts}`, `apps/api/src/app.module.ts`, `AGENTS.md` (rule 2), `docs/known-issues.md`

**Interfaces:**
- Produces:
  - `IdentityDirectory.listUserOrganizations(kcUserId: string): Promise<{ id: string; alias: string; name: string }[]>` (`GET organizations/members/{id}/organizations`).
  - `GET /api/me/workspaces` → `{ slug: string; name: string; current: boolean; webUrl: string; portalUrl: string }[]`, only tenants that are `active`, sorted by name.
  - `DELETE /api/members/me` → 204; 409 "You are the last owner. Make someone else an owner first." for the last owner; audit `member.left`; declared before `@Delete(':userId')`. Needs no permission beyond membership (signed in to this tenant).
  - `ProblemFilter`: a `DirectoryError` (from `@tenantry/keycloak-admin`) becomes 502 `Bad Gateway`, detail "The identity service is unavailable. Try again shortly."
- AGENTS.md rule 2 text: "Standard-tier roles come only from `organization.<alias>.groups`; enterprise roles come from `resource_access.tenantry-api`."

- [ ] **Step 1: Write the failing tests:** contract (`listUserOrganizations` returns the two orgs a user is in, none for a stranger); `workspaces.itest.ts` (user in `a` and `b`, a `failed` tenant `c` excluded, `current` true only for the host's tenant, URLs use `tenantOrigin`); `members.itest.ts` (member leaves → 204, removed from the directory, audit row `member.left`; last owner → 409; a token from another tenant → 403 per the Phase 1 rule); `problem.filter.test.ts` (`new DirectoryError(...)` → 502).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Leaving uses `lockTenantMembership` and the live owner count, like remove.
- [ ] **Step 4: Run** unit + integration + contract — Expected: PASS. Strike the 502, "members cannot leave" and AGENTS rule 2 rows in `docs/known-issues.md`.
- [ ] **Step 5: Commit** `feat(api): workspaces, leave a workspace, 502 when Keycloak is down`

### Task 7: Branding endpoints

**Files:**
- Create: `apps/api/src/modules/branding/{branding.module.ts,branding.controller.ts,public-branding.controller.ts,branding.service.ts,branding.schemas.ts,logo-type.ts,logo-type.test.ts,branding.itest.ts}`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/main.ts` (CORS), `apps/api/package.json` (`@tenantry/brand`, `@types/multer` dev)

**Interfaces:**
- Consumes: `meetsContrast`, `darkerUntilContrast` (Task 2); branding repositories (Task 4).
- Produces:
  - `sniffImageType(bytes: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null` — PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF????WEBP`.
  - `GET /api/tenants/:slug/branding` (public) → `{ name, primaryColor, logoUrl }`, `logoUrl = /api/tenants/<slug>/logo?v=<logoVersion>` or null; 404 for an unknown or inactive slug. CORS: `Access-Control-Allow-Origin` = `TENANTRY_AUTH_URL` origin only, `GET` only.
  - `GET /api/tenants/:slug/logo` (public) → bytes, `Content-Type` from the row, `Cache-Control: public, max-age=31536000, immutable` when `v` equals the current version, else `no-cache`; `X-Content-Type-Options: nosniff`; 404 without a logo.
  - `PUT /api/branding` `{ primaryColor: string | null }` — `tenant:settings`; 422 problem with extra member `suggestion` below 4.5:1; audit `branding.updated` with old and new colour.
  - `POST /api/branding/logo` multipart field `file` — `tenant:settings`; multer memory storage, `limits.fileSize = 262144` → 413; sniffed type null → 422; bumps `logoVersion`; audit `branding.logo_updated`.
  - `DELETE /api/branding/logo` — `tenant:settings`; 204; sets `logoVersion` null; audit `branding.logo_removed`.
  - `ProblemFilter` writes any extra fields of a `Problem` subclass (`ValidationProblem` gains optional `extras`), so `suggestion` reaches the client.

- [ ] **Step 1: Write the failing tests:** `logo-type.test.ts` (each magic number; SVG text `<svg` → null; 3 bytes → null); `branding.itest.ts`: owner PUTs `#0f62fe` → 200 and public GET shows it; `#ffcc00` → 422 with `suggestion` that passes `meetsContrast`; admin (no `tenant:settings`) → 403; logo PNG upload → public logo GET returns the same bytes and `image/png`; SVG bytes posted as `image/png` → 422; 262145 bytes → 413; DELETE → logo 404; another tenant's token on this host → 403; public branding for `failed` tenant → 404; CORS header present for the auth origin and absent for `http://evil.localhost`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit + `pnpm --filter @tenantry/api test:isolation` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): tenant branding — colour with contrast check, logo upload`

### Task 8: `@tenantry/app-kit` — shared app code

Pure move plus one extraction; no behaviour change. Existing web tests are the proof.

**Files:**
- Create: `packages/app-kit/` with `src/{api.tsx,ApiErrorNotification.tsx,FormDialog.tsx,RouterLink.tsx,SignedInApi.tsx,me.tsx,useResource.ts,roles.ts,TenantAuth.tsx,index.ts}`, the moved `api.test.ts`, and `TenantAuth.test.tsx`
- Modify: `apps/web/src/**` imports; delete `apps/web/src/lib/*` except `host.ts`; `eslint.config.mjs` (app-kit may import `@tenantry/oidc-client`, apps may not import `oidc-client-ts`)

**Interfaces:**
- Produces: everything `apps/web/src/lib` exported, same names, from `@tenantry/app-kit`; plus `TenantAuth({ slug, productName, notFound, children }: { slug: string; productName: string; notFound: ReactNode; children: (session: { signOut: () => void }) => ReactNode })` — the body of today's `TenantApp` (auth-config, client, `AuthProvider`, `SignedInApi`, `LoadMe`).

- [ ] **Step 1: Write the failing test** `TenantAuth.test.tsx`: with a fetch stub answering 404 for auth-config, `notFound` renders; with a config, the loading text "Signing in" renders.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/app-kit test` — Expected: FAIL.
- [ ] **Step 3: Move the files** (`git mv` to keep history), implement `TenantAuth`, make `apps/web/src/TenantApp.tsx` use it.
- [ ] **Step 4: Run** `pnpm lint typecheck test` — Expected: all PASS, web tests unchanged in count.
- [ ] **Step 5: Commit** `refactor: move shared app code into @tenantry/app-kit`

### Task 9: Session checks and single logout in `@tenantry/oidc-client`

**Files:**
- Modify: `packages/oidc-client/src/{auth-client.ts,auth-client.test.ts,AuthProvider.tsx,AuthProvider.test.tsx}`
- Create: `docs/decisions/0020-single-logout-session-check.md`

**Interfaces:**
- Produces:
  - `AuthClient.checkSession: () => Promise<boolean>` — refreshes with the refresh token; on failure removes the user and returns false. Concurrent calls share one in-flight promise.
  - `AuthProvider` listens to `visibilitychange`; when the page becomes visible it calls `checkSession()` and, on false, calls `signIn()` once (a module-level guard stops a second redirect while one is under way).
  - `signOut` calls `signoutRedirect({ id_token_hint, post_logout_redirect_uri: <origin>/ })`.

- [ ] **Step 1: Write the failing tests:** `auth-client.test.ts` with a stubbed `UserManager`: `checkSession` false and user removed when `signinSilent` rejects; two concurrent `checkSession` calls → one `signinSilent`; `signOut` passes `id_token_hint`. `AuthProvider.test.tsx`: dispatch `visibilitychange` with `document.visibilityState = 'visible'` and a failing session → `signIn` called exactly once, even when the event fires twice.
- [ ] **Step 2: Run** `pnpm --filter @tenantry/oidc-client test` — Expected: FAIL.
- [ ] **Step 3: Implement.** Write ADR-0020 (session check, not back-channel: why, and the gap — a tab that stays in front keeps its access token up to 5 minutes) and index it.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(oidc-client): session check on focus and single logout`

### Task 10: Web app — switchers, brand, UI pass

Run `ui-consistency:finding-patterns` for the header changes before Step 3; verify with `ui-consistency:verifying` (separate agent) after.

**Files:**
- Modify: `apps/web/src/{App.tsx,App.test.tsx,TenantApp.tsx}`, `apps/web/src/features/audit/{AuditRoute.tsx,AuditRoute.test.tsx}`, `apps/web/src/features/*` breadcrumbs, "Load more" buttons
- Create: `packages/app-kit/src/{useWorkspaces.ts,useBranding.ts,useBranding.test.tsx}`
- Modify: `apps/api/src/modules/audit/audit.service.ts` + itest (target label)

**Interfaces:**
- Consumes: `/api/me/workspaces` (Task 6), `/api/tenants/:slug/branding` (Task 7), `applyBrand` + switchers (Task 3).
- Produces: `useWorkspaces(): { slug; name; current; webUrl; portalUrl }[]`; `useBranding(slug): { name; primaryColor; logoUrl } | null` which also calls `applyBrand(brandTokens(primaryColor))` and clears it on unmount; both apps pass `logoUrl` and the tenant name to `AppShell`; audit entries gain `targetLabel: string | null` (member email or project name, resolved in the API).

- [ ] **Step 1: Write the failing tests:** `App.test.tsx` — with two workspaces the "Switch workspace" panel lists both; "Switch app" lists "Tenantry" (current) and "Tenantry Portal" with the portal URL. `useBranding.test.tsx` — `#0f62fe` → `--cds-button-primary` on `document.body`. `AuditRoute.test.tsx` — target column shows `targetLabel` and falls back to the id. Breadcrumb test — clicking the breadcrumb does not reload (router navigation). "Load more" shows `InlineLoading` while loading. `audit.itest.ts` — `targetLabel` is the member's email for `member.invited`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @tenantry/web test` + API itest — Expected: PASS. Strike the "Web UI" row in `docs/known-issues.md`.
- [ ] **Step 5: Commit** `feat(web): workspace and app switchers, tenant brand, UI pass`

### Task 11: Portal app — sign-in, dashboard, Branding settings page

Run `ui-consistency:finding-patterns` (reference: `packages/ui` `SettingsPage` and the web app's pages) before Step 3; verify after with a separate agent.

**Files:**
- Modify: `apps/portal/src/{main.tsx,App.tsx,App.test.tsx}`, `apps/portal/package.json` (`@tenantry/app-kit`, `@tenantry/brand`, `react-router`)
- Create: `apps/portal/src/{Root.tsx,lib/host.ts,lib/host.test.ts,features/dashboard/DashboardRoute.tsx,features/branding/BrandingRoute.tsx,features/branding/BrandingRoute.test.tsx}`
- Delete: `apps/portal/src/routes/DashboardRoute.tsx`

**Interfaces:**
- Consumes: `TenantAuth`, `useMe`, `useWorkspaces`, `useBranding`, `api` (app-kit); Task 7 endpoints.
- Produces: portal routes `/` (DashboardPage: tenant name, your role, links) and `/branding` (shown when `me.can('tenant:settings')`). Branding page: `SettingsPage` with a colour `TextInput` (`#rrggbb`), a live preview (primary `Button` and a `Link` inside a container that gets `applyBrand` of the typed colour), a `FileUploaderDropContainer` (accept `.png,.jpg,.jpeg,.webp`, 256 KB stated in the helper text), the current logo with "Remove logo", and the save bar. A 422 with `suggestion` shows an inline `InlineNotification` "This colour is too light for white text. Suggested: #xxxxxx" with a "Use this colour" button that fills the field.
- `portalSlugFromHost(hostname, baseDomain)` — `acme.portal.tenantry.localhost` → `acme`.

- [ ] **Step 1: Write the failing tests:** `host.test.ts`; `App.test.tsx` (owner sees "Branding" nav, admin does not; switchers present); `BrandingRoute.test.tsx` (save `#0f62fe` → PUT body; 422 suggestion → "Use this colour" fills `#xxxxxx`; upload calls POST with `FormData` field `file`; a file over 262144 bytes is refused in the browser with the same message the API gives, before upload).
- [ ] **Step 2: Run** `pnpm --filter @tenantry/portal test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS; `pnpm lint typecheck` clean (stylelint included).
- [ ] **Step 5: Commit** `feat(portal): signed-in portal with a branding settings page`

### Task 12: Tenant brand on the login page

**Files:**
- Create: `apps/login-theme/src/login/{tenant-brand.ts,tenant-brand.test.ts,pages/Login.test.tsx}`
- Modify: `apps/login-theme/src/login/{KcPage.tsx,pages/Login.tsx}`, `apps/login-theme/package.json` (`@tenantry/brand`, `@tenantry/ui` for `applyBrand`)

**Interfaces:**
- Produces:
  - `tenantFromLocation(search: string, storage: Storage): { origin: string; slug: string } | null` — reads `redirect_uri` from the query; slug = first label of its host; stores it under `tenantry.login.tenant`; with no `redirect_uri`, returns the stored value.
  - `loadTenantBrand(tenant, fetchFn = fetch): Promise<{ name: string; primaryColor: string | null; logoUrl: string | null } | null>` — `GET ${origin}/api/tenants/${slug}/branding`; null on any failure; `logoUrl` made absolute against `origin`.
  - The Login page shows the tenant's logo and name above the form and applies `brandTokens`; with null, "Tenantry".

- [ ] **Step 1: Write the failing tests:** `tenant-brand.test.ts` — redirect `http://acme.portal.tenantry.localhost:8080/auth/callback` → `{ origin: 'http://acme.portal.tenantry.localhost:8080', slug: 'acme' }` and stored; no query + stored → stored value; no query + empty storage → null; fetch rejects → null. `Login.test.tsx` with Keycloakify's `getKcContextMock({ pageId: 'login.ftl' })`: with a brand, the heading is "Sign in to Acme" and the logo image has `alt="Acme"`; without, "Sign in to Tenantry".
- [ ] **Step 2: Run** `pnpm --filter @tenantry/login-theme test` — Expected: FAIL.
- [ ] **Step 3: Implement.** Rebuild the image (`pnpm dev:stack`) and check in the built-in browser: `acme` login page shows the acme colour; after a wrong password the brand stays.
- [ ] **Step 4: Run** tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(login-theme): tenant logo and colour on the login page`

### Task 13: Company login — CoreDNS, `corp-demo` realm, `apps/ops`

**Files:**
- Create: `infra/dns/Corefile`, `infra/dns/zones/.gitkeep` (`test.db` generated, git-ignored), `infra/keycloak/corp-demo-realm.json`, `apps/ops/{package.json,tsconfig.json,vitest.config.ts,vitest.integration.config.ts,src/cli.ts,src/env.ts,src/commands/{domain.ts,idp.ts,dns.ts,tenants.ts},src/dns/{txt.ts,txt.test.ts,zone-file.ts,zone-file.test.ts},src/commands/domain.itest.ts,src/commands/idp.itest.ts}`, `docs/decisions/0022-company-idp-by-operator.md`
- Modify: `infra/docker-compose.yml` (service `dns`: `coredns/coredns:1.12.1`, `-conf /etc/coredns/Corefile`, ports `127.0.0.1:1053:53/udp` and `/tcp`, mounts; keycloak mounts the corp-demo realm), `packages/keycloak-admin` (interface, HTTP, fake, contract), `.env.example` (`TENANTRY_DNS_SERVER=127.0.0.1:1053`, `CORP_DEMO_CLIENT_SECRET=dev-corp-demo-secret`), root `package.json` (`"ops": "pnpm --filter @tenantry/ops exec tsx src/cli.ts"`), `scripts/lib/compose.test.mjs`, `scripts/lib/realm.test.mjs`

**Interfaces:**
- Produces (keycloak-admin):
  - `addOrganizationDomain(orgId: string, domain: string): Promise<void>` (verified: true; idempotent)
  - `createOidcIdentityProvider(input: { alias: string; issuer: string; clientId: string; clientSecret: string }): Promise<void>` — discovery from `${issuer}/.well-known/openid-configuration` done by Keycloak (`config.useDiscovery`/explicit URLs, whichever 26.8.1 accepts; the contract test pins it); `syncMode: IMPORT`, `trustEmail: true`.
  - `linkIdentityProvider(orgId: string, alias: string, domain: string): Promise<void>` — link to the org, then set `kc.org.domain = domain` and `kc.org.broker.redirect.mode.email-matches = true`.
  - `deleteIdentityProvider(alias): Promise<void>` (undo).
- Produces (ops): commands exactly as in the spec; exit code 0 on success, 1 on refusal with one line on stderr; `resolveTxt(name, server?: string): Promise<string[]>` with `server` from `TENANTRY_DNS_SERVER`; `upsertTxt(zoneText: string, name: string, value: string): string` (bumps the SOA serial). `idp link` order: check verified domain (refuse before any Keycloak call) → `addOrganizationDomain` → `createOidcIdentityProvider` → `linkIdentityProvider` → `insertIdp` + audit `idp.linked`, with `deleteIdentityProvider` on failure after creation. Audit actor is `system:ops`.
- `corp-demo` realm: client `tenantry-platform` (confidential, secret `CORP_DEMO_CLIENT_SECRET`, redirect `${TENANTRY_AUTH_URL}/realms/platform/broker/*`), user `alice@acme.test` (email verified; password set from `SEED_PASSWORD` by the seed, not in the file).

- [ ] **Step 1: Write the failing tests:** `zone-file.test.ts` (adds a TXT, replaces the same name's value, serial increases); `txt.test.ts` (joins chunked TXT strings); contract tests for the four directory methods (fake and real); `domain.itest.ts` (claim prints `_tenantry-verify.acme.test TXT "tenantry-verify=<token>"`; verify before the record → exit 1; after `dns set-txt` → verified; second tenant verifying the same domain → exit 1 "already verified by another workspace"); `idp.itest.ts` (unverified → exit 1 and the fake directory has no IdP; verified → IdP linked, audit row); `tenants sync-origins` adds both origins of every active tenant and a second run adds nothing; realm test (corp-demo client and user without a password); compose test (dns service on 127.0.0.1:1053).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** ADR-0022 (operator-only, DNS TXT proof, why redirect-by-domain) and index it.
- [ ] **Step 4: Run** unit, contract and `pnpm --filter @tenantry/ops test:isolation` — Expected: PASS. Manual: `pnpm ops domain claim/verify/idp link` for `acme.test`, then in the built-in browser sign in to `acme` as `alice@acme.test` — redirected to `corp-demo`, back signed in to `acme`.
- [ ] **Step 5: Commit** `feat(ops): domain verification and company identity provider linking`

### Task 14: Seed, demo script, isolation tests, release docs

**Files:**
- Create: `apps/ops/src/commands/seed.ts`, `apps/ops/src/commands/seed.itest.ts`, `packages/keycloak-admin/src/dev/seed-users.ts` (exported as `@tenantry/keycloak-admin/dev`), `tests/isolation/src/phase2.test.ts`, `docs/demo-script.md`, `CHANGELOG.md`
- Modify: root `package.json` (`"seed": "pnpm ops seed"`), `.env.example` (`SEED_PASSWORD=dev-seed-password`), `README.md` (guarantee rows "Logout in one app" and "Domain link without verified DNS record" → `tested`; "Try it" uses `pnpm seed`), `.github/workflows/ci.yml` (isolation job runs `pnpm seed` before the suite), `docs/known-issues.md`

**Interfaces:**
- Produces: `ensureUser({ email, firstName, lastName, password }): Promise<{ id: string }>` (dev only; idempotent; email verified). `ops seed`: users `owner@acme.test`… — acme: `ada@acme.test` owner, `ben@acme.test` admin, `cy@acme.test` member; globex: `gil@globex.test` owner, `gwen@globex.test` admin, `gus@globex.test` member; `pat@example.test` member of both; `alice@acme.test` in corp-demo; acme `#0f62fe`, globex `#198038`, each with a generated PNG logo; acme.test verified and linked to corp-demo. Second run changes nothing and exits 0.

- [ ] **Step 1: Write the failing tests:**
  - `seed.itest.ts`: running seed twice → second run reports "nothing to change"; `pat` lists both workspaces.
  - `phase2.test.ts` (whole stack): **single logout** — password-grant tokens for a user, end-session with the refresh token (`POST .../logout`), then a refresh with the same refresh token → 400 `invalid_grant`; **unverified domain link refused** — `ops idp link` for a claimed, unverified domain exits 1 and Keycloak has no IdP with that alias; **branding of another tenant** — tenant A owner's token on tenant B's host `PUT /api/branding` → 403 and B's branding unchanged; **portal host isolation** — A's token on `b.portal` host → 403.
- [ ] **Step 2: Run** `pnpm test:isolation` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** seed; write `docs/demo-script.md` (signup, SSO into the portal, switch as `pat`, branding with a refused colour, company login as alice, single logout — about two minutes, with exact URLs), `CHANGELOG.md` (`## 0.1.0`), README rows, known-issues (Phase 2 line; strike fixed rows; add anything found).
- [ ] **Step 4: Run** the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `pnpm dev:stack`, `pnpm seed`, `pnpm smoke`, `pnpm test:isolation` — Expected: all PASS. Walk `docs/demo-script.md` in the built-in browser at desktop and 375 px, light and dark.
- [ ] **Step 5: Commit** `feat: seeded demo, phase 2 isolation tests, v0.1.0 changelog`

### After the final review and the person's merge

- Create the annotated tag locally: `git tag -a v0.1.0 -m "Tenantry 0.1.0"` on the merge commit. The person pushes it.

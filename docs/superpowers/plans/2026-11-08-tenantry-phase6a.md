# Tenantry Phase 6a: a simpler Tenantry, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-time visitor understands and uses Tenantry without reading anything:

- a welcome page and a one-screen signup;
- two apps split by audience (Tenantry and Admin);
- a getting-started checklist;
- Tenantry's own logo;
- a product README.

**Architecture:**

- **Front end only**, apart from one Keycloak-facing change (the company login's display name). Pages move between the two SPAs as they are.
- **`@tenantry/ui`** learns nav groups and the Tenantry mark.
- **`@tenantry/app-kit`** decides who sees Admin.
- **Docs and assets** are plain files.

**Tech Stack:** React 19 + Vite, `@carbon/react` v11, react-router, Vitest + Testing Library, NestJS (untouched), Keycloak 26.8.1 admin API through `packages/keycloak-admin`, `@resvg/resvg-js` (dev only, for PNG icons).

**Spec:** `docs/superpowers/specs/2026-11-08-tenantry-phase6a-design.md`

## Global Constraints

- No API route, permission, table, RLS policy or isolation test changes.
- The only Keycloak-facing change is the company identity provider's `displayName` (spec §3).
- **UI rules (AGENTS.md):**
  - every screen starts from a `@tenantry/ui` page pattern;
  - Carbon components and `@carbon/icons-react` only;
  - Carbon tokens for colour, spacing and type (stylelint rejects raw `px`/`rem`, `box-shadow`, `border-radius` and gradients);
  - the header is always `g100`.
- **App names:** "Tenantry" (web) and "Admin" (portal). The portal's `<title>` is "Tenantry Admin".
- **Admin menu, in order:**
  - People `/people`;
  - Branding `/branding`;
  - Sign-in & security `/security`;
  - Audit log `/audit`;
  - Advanced, collapsed, holding Directory sync (SCIM) `/advanced/scim`, Customer apps `/advanced/apps`, and Keycloak console (external).
- **Admin is for owners and admins** (spec §1). Each entry is shown when:
  - People: `members:invite`;
  - Branding and Sign-in & security: `tenant:settings`;
  - Audit log: `audit:read`;
  - Customer apps: `apps:register` and Enterprise;
  - SCIM: `tenant:settings`;
  - Keycloak console: `me.consoleUrl` is set.
- **Tenantry menu:** Home `/` and Projects `/projects` (`projects:read`). `/patterns` exists only when `import.meta.env.DEV` is true.
- **Exact copy (from the spec):**
  - welcome line: "Sign-in, teams and branding for every customer workspace, built on Keycloak.";
  - Go box error: "Enter a workspace address, such as acme";
  - default company-login display name: `<workspace name> company sign-in`.
- **Checklist steps:** "Create a project", "Invite a teammate", "Add your colour and logo". The Hide key is `tenantry.checklist.hidden.<userId>.<slug>`.
- **Brand:**
  - colours `#0f62fe` (Blue 60), `#161616` (Gray 100) and `#f4f4f4` (Gray 10);
  - the mark is five tiles forming a T, with the junction tile in blue;
  - each SVG has a `<title>` and is at most 4 KB.
- **Conventions:**
  - ESM with `.js` import specifiers;
  - tests sit next to the code and are written first;
  - Conventional Commits, with no attribution lines;
  - nothing is pushed until the user asks.

## Review Focus

1. **A member's view.** A member gets no Admin link in the switcher, and opening any Admin address directly shows the not-allowed state, not a blank page or a crash.
2. **Old bookmarks:**
   - `/members`, `/audit`, `/applications/a1` and `/scim` land on the matching new page;
   - the customer-app test callback (`/applications/test-callback`) still works, because registered redirect URIs name it.
3. **Storage blocked** (private windows, blocked site data): the checklist still renders, and Hide fails quietly without throwing.
4. **What visitors type in the Go box:** ` Acme`, `https://acme.tenantry.localhost/projects`, `acme.tenantry.localhost:8080` and `ACME` all open `acme`; `a b`, `-acme` and an empty box show the error.
5. **A workspace with its own logo** shows its logo, not the Tenantry mark, in the header, and the login page for a workspace keeps the workspace's brand.

Each line has its test in the owning task (Tasks 3, 4, 5, 6).

---

### Task 1: The UI checklist (ui-consistency)

Not code. It runs before any task that changes what the user sees.

- [ ] **Step 1:** Run `ui-consistency:finding-patterns` for the work in spec §1, §2 and §7. The references are:
  - portal `BrandingRoute` for Admin settings pages;
  - web `ProjectsRoute` for lists;
  - `DashboardPage` for Home and the welcome page.
- [ ] **Step 2:** Save the checklist in the plan's workspace (`.superpowers/sdd/2026-11-08-tenantry-phase6a/ui-checklist.md`), never in the repo. Ledger any rulings.

### Task 2: Tenantry's brand assets

**Files:**

- Create:
  - `packages/ui/assets/brand/tenantry-mark.svg`
  - `packages/ui/assets/brand/tenantry-logo.svg` and `tenantry-logo-dark.svg`
  - `packages/ui/assets/brand/favicon.svg`
  - `scripts/brand-icons.mjs`
  - `scripts/lib/brand.test.mjs`
  - `docs/brand.md`
- Generate and commit: `favicon-32.png`, `apple-touch-icon.png` (180), `icon-512.png` and `social-preview.png` (1280×640), all in `packages/ui/assets/brand/`.
- Modify: root `package.json` (the dev dependency `@resvg/resvg-js`, and the script `"brand:icons": "node scripts/brand-icons.mjs"`).

**Interfaces:**

- Produces: the asset paths above. `packages/ui/package.json` exports `"./assets/*": "./assets/*"`.

- [ ] **Step 1: Write the failing test** `scripts/lib/brand.test.mjs`. For each SVG:
  - `assert.ok(size <= 4096)`;
  - `assert.match(svg, /<title>[^<]+<\/title>/)`;
  - `assert.match(svg, /viewBox="0 0 \d+ \d+"/)`;
  - the mark and the favicon contain `#0f62fe` exactly once;
  - each PNG exists, and its IHDR width and height are 32, 180, 512 and 1280×640 respectively.
- [ ] **Step 2:** Run `node --test scripts/lib/brand.test.mjs`. Expected: FAIL (the files are missing).
- [ ] **Step 3: Draw the SVGs by hand.**
  - **Mark:** a 32×32 viewBox with four 14×14 tiles and 2-unit gaps; the top-left tile is `#0f62fe`, the others `#161616`.
  - **Dark logo:** the neutral tiles and word are `#f4f4f4`.
  - **Logo:** the mark plus "Tenantry" as text in `IBM Plex Sans, sans-serif`, weight 600.
  - **Favicon:** the mark on a transparent background.
- [ ] **Step 4: Write `scripts/brand-icons.mjs`.** It renders the PNGs from `favicon.svg` with resvg. The social preview is the logo centred on `#f4f4f4`, with the tagline under it as text. Run `pnpm brand:icons`.
- [ ] **Step 5: Write `docs/brand.md`** per spec §7 (meaning, colours, clear space = ¼ of the mark's width, minimum 16 px, the don'ts).
- [ ] **Step 6:** Run `node --test scripts/lib/brand.test.mjs`. Expected: PASS. Then commit `feat: Tenantry logo and icons`.

### Task 3: AppShell nav groups and the Tenantry mark

**Files:**

- Modify: `packages/ui/src/shell/AppShell.tsx` and `packages/ui/src/index.ts`
- Test: `packages/ui/src/shell/AppShell.test.tsx`
- Modify: `apps/web/index.html`, `apps/portal/index.html` and `apps/login-theme/index.html` (favicon links, and the title "Tenantry Admin" for the portal)

**Interfaces:**

- Produces:

```ts
export interface NavItem {
  label: string;
  href: string;
  icon?: CarbonIconType;
  external?: boolean; // a plain <a> that opens in a new tab, not the router link
  children?: NavItem[]; // rendered as a collapsed SideNavMenu titled `label` (href unused)
}
```

`AppShell` shows the Tenantry mark (from `@tenantry/ui/assets/brand/tenantry-mark.svg`, `alt=""`) before the product name when `logoUrl` is null or absent.

- [ ] **Step 1: Write failing tests:**
  - `'renders a group collapsed, opening on click'`: the group button has `aria-expanded="false"`; after a click its child link is visible.
  - `'opens the group that holds the current page'`: with `currentPath` equal to a child's href, `aria-expanded="true"`.
  - `'an external item opens in a new tab'`: `target="_blank"` and `rel="noreferrer"`, and no router link.
  - `'shows the Tenantry mark without a workspace logo, and the workspace logo instead of it'` (Review Focus 5).
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** with Carbon `SideNavMenu`/`SideNavMenuItem`. The `defaultExpanded` prop is true when a child is current.
- [ ] **Step 4:** Add `<link rel="icon" type="image/svg+xml" href="…favicon.svg">` and `<link rel="apple-touch-icon" href="…apple-touch-icon.png">` to each app's `index.html`, imported from the ui package's assets through Vite.
- [ ] **Step 5:** Run `pnpm --filter @tenantry/ui test` and `pnpm --filter @tenantry/ui lint`. Expected: PASS. Commit `feat(ui): nav groups, external links and the Tenantry mark`.

### Task 4: Who sees Admin (app-kit)

**Files:**

- Modify: `packages/app-kit/src/workspaces.ts`
- Create: `packages/app-kit/src/admin.ts`
- Test: `packages/app-kit/src/admin.test.ts` and `workspaces.test.ts`

**Interfaces:**

- Produces:
  - `export function canSeeAdmin(can: (p: Permission) => boolean): boolean`, true when the person holds `members:invite`, `tenant:settings` or `audit:read`.
  - `appLinks(workspaces: Workspace[], current: 'web' | 'portal', options: { admin: boolean })` returns `[{ label: 'Tenantry', … }, { label: 'Admin', … }]`. The Admin entry is left out when `admin` is false, and the list is then empty, because a switcher needs two entries.
  - `export function adminUrl(workspaces: Workspace[], path: string): string | null`: the current workspace's `portalUrl` with `path` appended (used by redirects and checklist links).

- [ ] **Step 1: Write failing tests:**
  - `canSeeAdmin` is false for `ROLE_PERMISSIONS.member` and true for admin and owner;
  - `appLinks(..., { admin: false })` returns `[]`;
  - the labels are `['Tenantry', 'Admin']`;
  - `adminUrl(ws, '/people?invite=1')` is `'http://acme.portal.tenantry.localhost/people?invite=1'`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/app-kit test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update both callers (`apps/web/src/App.tsx`, `apps/portal/src/App.tsx`) to pass `{ admin: canSeeAdmin(me.can) }`.
- [ ] **Step 4:** Run `pnpm --filter @tenantry/app-kit test` and `pnpm typecheck`. Expected: PASS. Commit `feat(app-kit): Admin only for owners and admins`.

### Task 5: Admin (portal)

**Files:**

- Move (`git mv`) into `apps/portal/src/features/`:
  - `apps/web/src/features/members/*` → `people/`, renaming `MembersRoute` to `PeopleRoute` with the title "People";
  - `apps/web/src/features/audit/*` → `audit/`.
- Modify:
  - `apps/portal/src/App.tsx`;
  - `apps/portal/src/features/security/SecurityRoute.tsx` (title "Sign-in & security");
  - `apps/portal/src/features/applications/*` (titles "Customer apps"; internal links to `/advanced/apps…`);
  - `apps/portal/src/test-utils.tsx`, if the moved tests need web-only helpers.
- Delete: `apps/portal/src/features/dashboard/*`.
- Test: `apps/portal/src/App.test.tsx`, `features/people/PeopleRoute.test.tsx` and `features/audit/AuditRoute.test.tsx`.

**Interfaces:**

- Consumes: `NavItem.children` and `external` (Task 3); `canSeeAdmin` and `appLinks` (Task 4).
- Produces: the Admin routes in Global Constraints. `/people?invite=1` opens `InviteDialog` on load.

- [ ] **Step 1: Write failing tests** in `App.test.tsx`:
  - `'an owner sees People, Branding, Sign-in & security, Audit log and Advanced'`, with Advanced collapsed and holding SCIM and, on Enterprise, Customer apps;
  - `'an admin sees People and Audit log only'`;
  - `'a member sees the not-allowed page at /people and no menu entries'` (Review Focus 1); use the existing forbidden state of `app-kit` if one exists, otherwise a `DetailPage` titled "You can't open Admin" with a link back to Tenantry;
  - `'opens on People for an owner'` (`/` redirects to the first allowed page);
  - `'old paths redirect'`: `/applications` → `/advanced/apps`, `/applications/a1` → `/advanced/apps/a1`, `/scim` → `/advanced/scim`;
  - `'the test callback keeps its path'`: `/applications/test-callback` renders `TestCallbackRoute` (Review Focus 2);
  - `'console link only with consoleUrl'`: an external item in Advanced;
  - `'/people?invite=1 opens the invite dialog'`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/portal test`. Expected: the new tests FAIL. The moved page tests may fail on imports; fix their imports only.
- [ ] **Step 3: Implement the routes, redirects (`<Navigate replace>`), menu and retitles.** The page bodies don't change.
- [ ] **Step 4:** Run `pnpm --filter @tenantry/portal test && pnpm --filter @tenantry/portal lint`. Expected: PASS. Commit `feat(portal): Admin holds people, settings and an Advanced group`.

### Task 6: Tenantry home, the welcome page and signup (web)

**Files:**

- Create:
  - `apps/web/src/features/home/HomeRoute.tsx` and `Checklist.tsx`;
  - `apps/web/src/features/welcome/WelcomeRoute.tsx`;
  - `apps/web/src/lib/workspace-input.ts`;
  - tests next to each.
- Modify:
  - `apps/web/src/App.tsx` (menu, routes, redirects to Admin, Patterns in dev only);
  - `apps/web/src/Root.tsx` and `features/signup/SignupApp.tsx` (apex: `/` is the welcome page, signed out; `/signup` signs in with `prompt=create`);
  - `features/signup/SignupRoute.tsx` (one screen);
  - `features/not-found/NotFoundPage.tsx` (the Go box);
  - `.env.example` (`VITE_DEMO_WORKSPACES=acme,globex,initech`);
  - `packages/oidc-client/src/auth-client.ts` (`signIn(options?: { prompt?: 'create' })`, passing `prompt` to `signinRedirect`).
- Delete: `apps/web/src/features/dashboard/*`.

**Interfaces:**

- Consumes: `adminUrl`, `canSeeAdmin` and `appLinks` (Task 4); `DashboardPage`, `TileGrid` and `StatTile` from `@tenantry/ui`.
- Produces: `export function workspaceFromInput(input: string, baseDomain: string): string | null`. It trims and lower-cases the input, then reduces it to its first DNS label after stripping any scheme, path and port. It returns `null` unless the result matches `^[a-z][a-z0-9-]{1,31}$` and doesn't end in `-`.

- [ ] **Step 1: Write failing tests:**
  - **`workspace-input.test.ts`:** `'  Acme '`, `'ACME'`, `'https://acme.tenantry.localhost/projects'` and `'acme.tenantry.localhost:8080'` all give `'acme'`; `''`, `'a b'` and `'-acme'` give `null` (Review Focus 4).
  - **`WelcomeRoute.test.tsx`:**
    - the heading "Tenantry" and the exact welcome line;
    - Go with `bad input` shows "Enter a workspace address, such as acme";
    - Go with `acme` calls `window.location.assign('http://acme.tenantry.localhost/')`;
    - the demo tile is absent when `VITE_DEMO_WORKSPACES` is unset, and links each slug when set;
    - "Create a workspace" links to `/signup`.
  - **`Checklist.test.tsx`:**
    - each step shows done (a check mark, no action) when its rule holds: projects ≥ 1; members > 1 or open invites ≥ 1; branding colour or logo set;
    - the invite link is `adminUrl(ws, '/people?invite=1')`;
    - with all three done, nothing renders;
    - Hide stores the key and hides it;
    - when `localStorage.getItem` throws, the checklist renders, and Hide hides it for this visit without throwing (Review Focus 3).
  - **`HomeRoute.test.tsx`:**
    - a member sees no checklist, only the five most recent projects and a link to Projects;
    - an owner with no projects types a name and presses Create: `POST /api/projects` is called with `{ name }`, and the step shows done.
  - **`NotFoundPage.test.tsx`:** the page has the Go box (the same behaviour as the welcome page's) and a link to the welcome page.
  - **`App.test.tsx`:**
    - the menu is Home and Projects;
    - `/members` and `/audit` call `window.location.replace` with the Admin `/people` and `/audit` URLs (Review Focus 2);
    - `/patterns` isn't routed when `import.meta.env.DEV` is false.
  - **`SignupRoute.test.tsx`:**
    - one screen with Workspace name, Address and "Create workspace";
    - the address follows the name until edited;
    - the host line shows `acme.tenantry.localhost`;
    - a taken address shows the API message on the Address field.
  - **`auth-client` test:** `signIn({ prompt: 'create' })` passes `prompt: 'create'`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/web test && pnpm --filter @tenantry/oidc-client test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The welcome page and Home use `DashboardPage`.
  - Checklist rows use Carbon `Tile`s in `TileGrid`, with the `CheckmarkFilled` icon for done.
  - Every `localStorage` access is wrapped in `try/catch`.
  - Signup keeps its slug rules and availability call. It drops the review step and calls availability and then create on submit.
- [ ] **Step 4:** Run the same tests, plus `pnpm --filter @tenantry/web lint`. Expected: PASS. Commit `feat(web): welcome page, one-screen signup, Home and its checklist`.

### Task 7: The login page brand without a workspace

**Files:**

- Modify: `apps/login-theme/src/login/Template.tsx`
- Test: `apps/login-theme/src/login/brand.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - `'shows the Tenantry logo without a workspace'`: an `img` named "Tenantry", from `tenantry-logo.svg`;
  - the existing workspace test still expects the workspace logo and no Tenantry logo (Review Focus 5).
- [ ] **Step 2:** Run `pnpm --filter @tenantry/login-theme test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Without a brand, render the Tenantry logo, with its `alt` text as the name. The workspace path doesn't change.
- [ ] **Step 4:** Run `pnpm --filter @tenantry/login-theme test`. Expected: PASS. Commit `feat(login-theme): Tenantry logo when no workspace applies`.

### Task 8: Company-login display name

**Files:**

- Modify:
  - `packages/keycloak-admin/src/identity-directory.ts` (`CompanyIdentityProvider.displayName: string`; new `setIdentityProviderDisplayName`);
  - `http-identity-directory.ts` (send `displayName` on create, and implement the setter);
  - the in-memory fake in `packages/keycloak-admin/src/testing/`;
  - `apps/ops/src/commands/idp.ts` and `apps/ops/src/cli.ts` (the `--display-name` option);
  - `apps/ops/src/seed/seed.ts` (display name `Acme Corp`).
- Test:
  - `apps/ops/src/commands/idp.itest.ts`;
  - `apps/ops/src/seed/*.itest.ts`, if the seed's itest asserts link output;
  - the keycloak-admin contract test for identity providers;
  - `apps/api/src/modules/enterprise/migration.itest.ts` (the copy keeps `displayName`).

**Interfaces:**

- Produces: `setIdentityProviderDisplayName(alias: string, displayName: string): Promise<{ changed: boolean }>`. It reads the instance and writes it back only when the name differs.

- [ ] **Step 1: Write failing tests:**
  - `linkIdp` without `displayName` sets `'Acme company sign-in'` for workspace "Acme";
  - a rerun with `'Acme Corp'` reports a change and sets it;
  - a rerun with the same name reports nothing to change;
  - the contract test: create with a display name, then read it back from `getIdentityProvider` (`IdentityProviderSettings` gains `displayName: string | null`);
  - the move copies `displayName` into the new realm.
- [ ] **Step 2:** Rebuild `@tenantry/keycloak-admin`, then run `pnpm --filter @tenantry/ops test:integration` (or the package's itest script) and the keycloak-admin itest. Expected: FAIL.
- [ ] **Step 3: Implement.** `idp-copy.ts` takes the display name from `getIdentityProvider`.
- [ ] **Step 4:** Run the same tests. Then run `pnpm seed` twice against the running stack: the first run updates `acme-corp`'s name, the second prints `nothing to change`. Commit `feat(ops): company logins get a display name`.

### Task 9: Small fixes

**Files:**

- Modify: `scripts/dev-stack.mjs`
- Test: the `scripts/lib/` test for the printed URL. Extract `export function welcomeUrl(port: number, baseDomain = 'tenantry.localhost'): string` into `scripts/lib/urls.mjs`.

- [ ] **Step 1: Write failing tests:** `welcomeUrl(80)` is `'http://tenantry.localhost'` and `welcomeUrl(8080)` is `'http://tenantry.localhost:8080'`.
- [ ] **Step 2:** Run `pnpm test:scripts`. Expected: FAIL.
- [ ] **Step 3:** Implement, and use it in the last line of dev-stack.
- [ ] **Step 4:** Run `pnpm test:scripts`. Expected: PASS. Commit `fix: dev-stack points at the welcome page`.

### Task 10: Docs: ADRs, setup, README

**Files:**

- Create:
  - `docs/decisions/0027-tenantry-and-admin.md`;
  - `docs/SETUP.md`.
- Modify:
  - `docs/decisions/0018-signup-saga.md` (Update, Phase 6a);
  - `0022-company-idp-by-operator.md` (Update: `--display-name`);
  - `docs/decisions/README.md` (row 0027);
  - `README.md` (rewritten per spec §6);
  - `docs/demo-script.md`;
  - `CHANGELOG.md`;
  - `docs/known-issues.md` (date; nothing struck);
  - `AGENTS.md` (portal described as Admin; `docs/SETUP.md` in Layout).

- [ ] **Step 1: ADR-0027** in the house ADR format: context (spec "Why"), decision (§1 tables and the owners-and-admins rule), consequences (old paths redirect; members lose the member-list page but keep API reads).
- [ ] **Step 2: `docs/SETUP.md`**, covering every bullet of spec §6 "docs/SETUP.md":
  - the command table is copied from AGENTS.md;
  - the demo accounts table names the accounts and says the password is `SEED_PASSWORD` in `.env`, never its value.
- [ ] **Step 3: `README.md`**, in spec §6's order:
  - a centred `<picture>` logo (`packages/ui/assets/brand/tenantry-logo.svg`, dark source `tenantry-logo-dark.svg`), the tagline, and badges (CI workflow status, MIT, Keycloak 26.8, Node 22, TypeScript);
  - the hero screenshot placeholder `docs/images/welcome.png` (taken in Task 11);
  - the problem, features and guarantees (shortened, linking to `tests/isolation`);
  - a Mermaid architecture diagram;
  - **Built with:** one shields.io badge per technology, `https://img.shields.io/badge/<Name>-<hex>?logo=<simple-icons-slug>&logoColor=white`, each linking to the project site. Slugs: `typescript`, `nodedotjs`, `nestjs`, `react`, `vite`, `ibm` (Carbon), `keycloak`, `postgresql`, `drizzle`, `docker`, `caddy`, `turborepo`, `pnpm`, `vitest`. Keycloakify gets a plain badge without a logo;
  - "Try it in five minutes" (3 commands, then a link to SETUP);
  - documentation links, the roadmap and the licence.
- [ ] **Step 4: Check.**
  - Run `pnpm lint` (prettier and markdown).
  - Every relative link in README and SETUP resolves: a small `node` check in `scripts/lib/readme-links.test.mjs` asserts each `](./…)` and `](docs/…)` target exists, apart from `docs/images/*.png` until Task 11.
  - Commit `docs: product README, SETUP.md, ADR-0027`.

### Task 11: Walkthrough, screenshots and UI verification

Needs the user to sign in in the browser pane as `ada@example.test` (owner) and `cy@example.test` (member).

- [ ] **Step 1:** `pnpm dev:stack && pnpm seed`. Open `http://tenantry.localhost[:port]`, then walk through:
  - welcome page → a demo workspace;
  - Home checklist → invite (opens Admin › People with the dialog) → Branding;
  - Advanced;
  - as the member: no Admin.

  Do it in light and dark, and at 375 px width.

- [ ] **Step 2: Screenshots** to `docs/images/` (light, 1280 wide, each under 300 KB, alt text in README): `welcome.png`, `home-checklist.png`, `admin-people.png`, `branding.png`, `login-branded.png`. Remove the README-links test exception from Task 10.
- [ ] **Step 3:** Run `ui-consistency:verifying` with a separate agent, against the Task 1 checklist, over the new and moved pages. Fix what it reports, test first.
- [ ] **Step 4: The full gate.**
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build`;
  - `pnpm smoke`;
  - `pnpm seed` twice (the second prints `nothing to change`);
  - `pnpm test:isolation`.

  Commit `docs: screenshots for the README`.

---

## Part 2: redesign, one menu, search and notifications (spec §8)

Added after the first signed-in walkthrough. Global Constraints above still apply; these add to them:

- **Icons:** `@carbon/icons-react` only, at 16 in the menu and 20 in page headers. Menu icons: Home `Home`, Projects `Folder`, People `UserMultiple`, Branding `ColorPalette`, Sign-in & security `Security`, Audit log `RecentlyViewed`, Advanced `Settings`, Directory sync `DataShare`, Customer apps `Application`, Keycloak console `Launch`.
- **Notifications:** rules exactly as the spec §8.4 table; 30 items, 30 days, 14-day token warning, 60-second refresh while visible.
- **New tenant table** `notification_reads (tenant_id, user_id, read_until)` with forced RLS; the `security definer` function `open_invites_for_email(text)` is the only cross-workspace read added (ADR-0028).

### Review Focus (Part 2)

1. **A member's notifications** never include team, workspace or security events, even when the member is the target of one (for example `member.removed` of someone else).
2. **Another workspace's events** never appear, even when the same person belongs to both workspaces.
3. **An unverified email** never sees another workspace's invite, and a revoked or accepted invite never shows.
4. **Search for a member** never lists Admin pages, and an item from the other app opens the other app's address, not a router path that 404s.
5. **The menu on a medium screen** collapses to icons and nothing overlaps the page (the bug from the first walkthrough).

### Task 12: Shared UI pieces and the redesigned shell

**Files:**

- Create in `packages/ui/src/patterns/`: `EmptyState.tsx`, `SetupCard.tsx`, `Avatar.tsx`, with tests.
- Modify: `tiles.tsx` (`StatTile` takes `icon?: CarbonIconType`), `PageHeader.tsx` and every pattern (`icon?: CarbonIconType`), `shell/AppShell.tsx`, `styles/index.scss`, `index.ts`.
- Test: `shell/AppShell.test.tsx`, `patterns/patterns.test.tsx`.

**Interfaces (produces):**

```ts
export interface NavItem {
  label: string;
  href: string;
  icon?: CarbonIconType;
  external?: boolean;
  children?: NavItem[];
  section?: string;
}
export function EmptyState(p: {
  icon: CarbonIconType;
  title: string;
  body: string;
  action?: ReactNode;
}): JSX.Element;
export function SetupCard(p: {
  title: string;
  steps: { label: string; done: boolean; content: ReactNode }[];
  onHide?: () => void;
}): JSX.Element | null;
export function Avatar(p: { name: string; size?: 'sm' | 'md' }): JSX.Element; // initials of the first two words, or the first two letters
// AppShell gains: appName?: string ("Tenantry" | "Admin"), brandColor?: string | null, headerActions?: ReactNode (search, bell), userName?: string
```

- [ ] **Step 1: Failing tests:**
  - `EmptyState` renders its icon (aria-hidden), heading level 2, body and action;
  - `SetupCard` shows "2 of 3 done" and a progress bar at 67 %, renders nothing when every step is done, and calls `onHide`;
  - `Avatar('Ada Acme')` shows "AA" and `Avatar('ada@example.test')` shows "AD";
  - `PageHeader` with an icon puts it before the title, aria-hidden;
  - `AppShell`:
    - the header badge shows the workspace logo, or the workspace's first letter on `brandColor`, then the workspace name and `appName`;
    - `headerActions` render in the global bar before the switchers;
    - the account button shows the initials;
    - nav items render their icons, and items with the same `section` sit under one heading.
- [ ] **Step 2:** `pnpm --filter @tenantry/ui test` → FAIL.
- [ ] **Step 3: Implement** with Carbon `Tile`, `ProgressBar`, `Tag`, `SideNavDivider` and a section label. The side nav uses `isRail` below `lg` (icons, expands on hover); the `lg` offset rule from the first walkthrough stays.
- [ ] **Step 4:** test, lint and build ui → PASS. Commit `feat(ui): empty states, setup card, avatars, icons and a redesigned shell`.

### Task 13: One menu for both apps

**Files:** Create `packages/app-kit/src/menu.ts` and its test. Modify `apps/web/src/App.tsx` and `apps/portal/src/App.tsx` to use it; delete their own page lists.

**Interfaces:** `export function workspaceMenu(me: Person, workspaces: Workspace[], app: 'web' | 'portal'): NavItem[]`. Items in this app get the path; items in the other app get `adminUrl`/`webUrl` + path as a full URL (no `external`: same tab).

- [ ] **Step 1: Failing tests:**
  - an owner on Enterprise gets Home, Projects, a Workspace section (People, Branding, Sign-in & security, Audit log) and Advanced (Directory sync, Customer apps, and Keycloak console when `consoleUrl` is set), each with the constraint's icon;
  - from `web`, People's href is `http://acme.portal.tenantry.localhost/people`; from `portal`, Home's href is `http://acme.tenantry.localhost/` (Review Focus 4);
  - an admin of a Standard workspace gets Home, Projects, People and Audit log;
  - a member gets Home and Projects;
  - with workspaces not loaded yet, other-app items are left out rather than given a bad link.
- [ ] **Step 2–4:** RED, implement, GREEN. The existing web and portal App tests keep passing, with the menu assertions moved to the new names. Commit `feat(app-kit): one menu for Tenantry and Admin`.

### Task 14: Search

**Files:** Create `packages/app-kit/src/search/SearchDialog.tsx`, `search.ts` (pure matching) and tests. Wire it into both apps' `headerActions`.

**Interfaces:** `export function searchResults(q: string, sources: { pages: NavItem[]; people: { userId; email; displayName }[]; projects: { id; name }[] }): { pages: Hit[]; people: Hit[]; projects: Hit[] }`, where a `Hit` is `{ label, detail?, href }`, case-insensitive substring matching on label, detail and email, and at most 5 per group.

- [ ] **Step 1: Failing tests:**
  - `searchResults('ad', …)` finds Ada by name and Admin pages by label;
  - an empty query returns no hits;
  - a group never holds more than 5;
  - the dialog opens on Ctrl+K and on the header button, Esc closes it, Enter opens the first hit, and the arrow keys move between hits;
  - a member's dialog has no Admin pages (Review Focus 4);
  - people come from `/api/members` only for `members:read`, and projects from `/api/projects` only for `projects:read`.
- [ ] **Step 2–4:** RED, implement (Carbon `ComposedModal`, `Search`), GREEN. Commit `feat: search across pages, people and projects`.

### Task 15: Notifications in the database

**Files:**

- Create: migration `packages/db/migrations/0006_phase6a.sql`, schema `notification-reads.ts`, repository `repositories/notifications.ts`, and `test-integration/phase6a.itest.ts`.
- Modify: schema index, exports.

**Interfaces:**

- `getReadUntil(tx, userId): Promise<Date | null>` and `markRead(tx, userId, at: Date): Promise<void>` (upsert).
- `listAuditSince(tx, since: Date, actions: string[], limit: number): Promise<AuditEntry[]>`.
- `openInvitesForEmail(db, email: string): Promise<{ slug: string; name: string; role: Role }[]>`, which calls the SQL function.

- [ ] **Step 1: Failing itests:**
  - `notification_reads` rows are invisible across tenants (RLS forced, the app role is not the owner);
  - `markRead` twice keeps the later time;
  - `open_invites_for_email('Dora@x.test')`:
    - finds an open invite to `dora@x.test` in workspace B;
    - leaves out revoked and accepted invites, and workspaces that aren't active;
    - returns nothing for `other@x.test`;
  - the function returns only slug, name and role (no ids or emails).
- [ ] **Step 2–4:** RED, write the migration (table, RLS policy, `security definer` function with `set search_path = public`, `revoke all … from public`, `grant execute … to tenantry_app`), GREEN against the stack. Commit `feat(db): notification reads and open invites by email`.

### Task 16: Notifications API

**Files:**

- Create: `apps/api/src/modules/notifications/` (module, controller, service, rules, tests, itest).
- Modify: `app.module.ts`, `tests/isolation/src/phase6a.test.ts` (new), and the guarantees table in `tests/isolation/README.md`.

**Interfaces:** `GET /api/notifications` → `{ items: Notification[]; unread: number }`; `POST /api/notifications/read` → 204. Both are for any signed-in member of the workspace. `Notification = { id; kind: 'you' | 'team' | 'workspace' | 'security' | 'expiring' | 'invite'; title; body; href; createdAt; unread }`.

- [ ] **Step 1: Failing tests:**
  - **rules (unit):** each audit action in spec §8.4 maps to its kind and audience;
    - your own actions are left out;
    - a member gets only "you" items, including `member.role_changed` about them, and never `member.removed` about someone else (Review Focus 1);
    - titles read like "Ben joined Acme" and "Your role is now Admin";
  - **itest:** an owner sees team, workspace and security items;
    - an admin sees no security items;
    - a token expiring in 10 days gives one "expiring" item, and one in 20 days none;
    - mark-read zeroes `unread`, and a newer event counts again;
    - with `email_verified: false`, no invite items appear;
  - **isolation (Review Focus 2 and 3):** a person in workspaces A and B sees only A's events on A's address; another workspace's invite shows only to its verified address.
- [ ] **Step 2–4:** RED, implement, GREEN. Commit `feat(api): notifications from the audit log`.

### Task 17: The bell

**Files:** Create `packages/app-kit/src/notifications/NotificationsBell.tsx` and its test; wire it into both apps' `headerActions`.

- [ ] **Step 1: Failing tests:**
  - the badge shows the unread count, with none at 0;
  - opening it lists items with their kind icon, title, body and relative time ("5 min ago");
  - "Mark all as read" posts and clears the badge;
  - an item links to its `href`;
  - it refreshes every 60 s, using fake timers, and not while `document.hidden`;
  - an API error shows inline and keeps the bell working.
- [ ] **Step 2–4:** RED, implement (Carbon `HeaderGlobalAction`, `HeaderPanel`, the `Notification` icon), GREEN. Commit `feat: the notifications bell`.

### Task 18: Redesign the pages

**Files:** every page in `apps/web/src/features/` and `apps/portal/src/features/`, and their tests.

- [ ] **Step 1: Failing tests, per page:**
  - **Home:**
    - the greeting by time of day with the first name;
    - the `SetupCard` with "N of 3 done";
    - stat tiles (People, Projects and Open invites for owners and admins; Projects only for members);
    - recent projects, or `EmptyState` "Start your first project".
  - **People, Projects, Audit log, Customer apps:**
    - a toolbar search filters the rows;
    - people show an `Avatar` and a role `Tag`;
    - the empty state is an `EmptyState`.
  - **Every page:** its page header has its icon and a description.
- [ ] **Step 2–4:** RED, implement page by page, GREEN. Run `ui-consistency:verifying` against the updated checklist (Task 1's file, extended with the new shared pieces). Commit per app: `feat(web): redesigned pages`, `feat(portal): redesigned pages`.

### Task 19: Login pages

**Files:** `apps/login-theme/src/login/` styles and `Template.tsx`; test `KcPage.test.tsx`.

- [ ] **Step 1: Failing test:** the "Or sign in with" heading is the same element and size as the page's other section headings (an `h2` with the shared class), and the provider buttons sit in a list.
- [ ] **Step 2–4:** RED, implement, GREEN. Commit `fix(login-theme): tidy spacing and the sign-in-with heading`.

### Task 20: README and records

**Files:**

- Modify: `README.md` (Built with under the badges; the two-tier Mermaid diagram in The problem; new screenshots), `docs/decisions/0027-tenantry-and-admin.md` (update: one menu), CHANGELOG, `docs/known-issues.md`.
- Create: `docs/decisions/0028-notifications.md` and its row in the ADR index.

- [ ] **Step 1:** ADR-0028:
  - notifications from the audit log at read time, the audiences, `notification_reads`;
  - the one `security definer` function and why (an invite lives in another workspace's rows; only the verified email reads it; it returns only slug, name and role);
  - alternatives (a notifications table written on every action; Keycloak organization invitations).
- [ ] **Step 2:** README changes per spec §8.5. `scripts/lib/readme-links.test.mjs` keeps passing.
- [ ] **Step 3:** Commit `docs: one menu, notifications, and a clearer README`.

### Task 21: Walkthrough, screenshots, final gate

Needs a signed-in session in the browser pane (owner `ada@example.test`, member `cy@example.test`).

- [ ] **Step 1:** Rebuild the stack and seed. Walk through: welcome → acme → Home → search → bell → People (Admin, same menu) → Branding → Advanced; then as the member. Check light and dark themes, 1280 and 768 px wide.
- [ ] **Step 2:** Screenshots at 1280 px in the light theme into `docs/images/`: `welcome.png`, `home.png`, `admin-people.png`, `search.png`, `notifications.png`, `login-branded.png`. Remove the README-links exception.
- [ ] **Step 3:** The full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, smoke, seed twice, `pnpm test:isolation`. Then the final review (self-review, as the user asked for no subagents) and the deferred-minors list.

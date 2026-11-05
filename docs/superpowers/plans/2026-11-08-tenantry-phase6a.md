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

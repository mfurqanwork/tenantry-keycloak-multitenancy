# Tenantry Phase 6a: a simpler Tenantry

Status: Draft for review · Date: 2026-11-08 · Branch: `phase-6`

## Why

Phases 0–5 added features page by page. A first-time visitor now meets:

- a bare Keycloak sign-in page at the main address;
- an address printed by `pnpm dev:stack` (`demo.`) that says "Workspace not found";
- settings split across two apps with no rule behind it (people in one, branding and security in the other);
- a developer page (Patterns) in the main menu;
- tile dashboards that only link elsewhere;
- IT-admin features (SCIM, customer apps, the Keycloak console) on the same level as everyday ones;
- a company-login button labelled with its raw alias, `acme-corp`.

Phase 6 is split in three, each with its own spec, plan and PR:

- **6a (this spec):** a simpler Tenantry.
- **6b:** running in production: `compose.prod.yml`, TLS, backups, health, metrics, logs, rate limits, non-root images, the production realm.
- **6c:** v1.0: the k6 load test, security review, docs site, hosting and the deployment guide.

## Who it is for

**A first-time visitor**, such as a recruiter or engineer trying the demo for a few minutes. They should be able to:

1. create a workspace, or open a demo one;
2. invite someone;
3. brand it;
4. see one sign-in carry across two apps;

all without reading anything. Everything a company's IT team needs stays reachable, one level down.

## Success criteria

- From the main address, a visitor reaches a working workspace in two actions (Create a workspace → one form), or one (a demo workspace link).
- Each app's menu has at most four everyday entries. IT-admin features sit under a collapsed **Advanced** group.
- Every page's title matches its menu entry.
- A member, who can't open any Admin page, never sees Admin.
- Permissions and existing API routes stay as they are. The new pieces are the notifications endpoints and the `notification_reads` table (section 8.4), each with isolation tests. The one Keycloak-facing change is the identity provider's display name.

## 1. Tenantry and Admin (ADR-0027)

The two SPAs keep their own origins, which keeps the single-sign-on demo and the README guarantee. They now divide the work by who it's for.

### Tenantry (`apps/web`, `<slug>.tenantry.localhost`): the product

| Menu     | Page                                       | Who             |
| -------- | ------------------------------------------ | --------------- |
| Home     | the checklist (§2.3), then recent projects | everyone        |
| Projects | unchanged                                  | `projects:read` |

- Members and the Audit log move to Admin.
- Patterns leaves the menu. `/patterns` is routed only when `import.meta.env.DEV` is true.
- The tile dashboard is replaced by Home.

### Admin (`apps/portal`, `<slug>.portal.tenantry.localhost`): the workspace

| Menu                            | Path                                                              | Page                                                                                           | Shown when                     |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| People                          | `/people`                                                         | today's web Members page, moved unchanged (members, invites, the row menu with console access) | `members:invite`               |
| Branding                        | `/branding`                                                       | unchanged                                                                                      | `tenant:settings`              |
| Sign-in & security              | `/security`                                                       | today's Security page, retitled                                                                | `tenant:settings`              |
| Audit log                       | `/audit`                                                          | today's web Audit log, moved unchanged                                                         | `audit:read`                   |
| **Advanced** (group, collapsed) |                                                                   |                                                                                                | any child shown                |
| · Directory sync (SCIM)         | `/advanced/scim`                                                  | today's SCIM page                                                                              | `tenant:settings`              |
| · Customer apps                 | `/advanced/apps` (and `/advanced/apps/new`, `/advanced/apps/:id`) | today's Applications pages, retitled                                                           | `apps:register` and Enterprise |
| · Keycloak console              | external link                                                     | `me.consoleUrl`                                                                                | `me.consoleUrl` is set         |

- **Admin is for owners and admins.** A member holds `members:read` and `apps:read` (`packages/auth/src/roles.ts`), but no Admin page is shown for them: People needs `members:invite`, and Customer apps needs `apps:register`. The API's permissions don't change, so a member can still read the member list through the API.
- Admin opens on the first page the person may see, in menu order.
- The portal's tile dashboard is removed.
- The test sign-in callback for customer apps keeps its current path, because registered redirect URIs name it.
- The Advanced group uses `AppShell`'s side-nav menu, a Carbon `SideNavMenu`, collapsed by default.

### Between them

- The app switcher names the two apps **Tenantry** and **Admin**. Admin is listed only when the person may see at least one Admin page.
- Old addresses redirect:
  - web `/members` → Admin `/people`;
  - web `/audit` → Admin `/audit`;
  - portal `/applications…` → `/advanced/apps…`;
  - portal `/scim` → `/advanced/scim`.
- Cross-app redirects use the same `appLinks` URLs the switcher uses.
- The API is untouched. Both apps already call `/api` on their own origin with the same token audience.

## 2. The first minutes

### 2.1 Welcome page (`tenantry.localhost`)

The apex host shows a page with no sign-in until the visitor picks an action. It uses the `DashboardPage` pattern, with one tile per action:

- **Heading:** "Tenantry". **Line:** "Sign-in, teams and branding for every customer workspace, built on Keycloak."
- **Create a workspace:** goes to `/signup`, which starts sign-in with `prompt=create`. Keycloak 26 opens its registration page, which also links to sign-in. The signup form follows (§2.2).
- **Go to your workspace:** a text field and a **Go** button.
  - The input is cleaned up: trimmed, lower-cased, and a pasted URL reduced to its first label.
  - It must match the slug rules, or the field shows "Enter a workspace address, such as acme".
  - It opens `<slug>.<base domain>[:port]`. An unknown workspace lands on the not-found page (below).
- **Try a demo workspace:** links to each slug in `VITE_DEMO_WORKSPACES`, a comma-separated list. The tile is shown only when the list is set. `.env.example` sets `acme,globex,initech`; production leaves it empty.

The not-found page gets the same **Go to your workspace** field and a link back to the welcome page.

### 2.2 Signup: one screen

- **Fields:**
  - **Workspace name**;
  - **Address**, filled in from the name as you type: lower-cased, spaces and symbols become `-`, cut to the slug's length limit. Editing the address stops the filling-in.
- A line under the address shows the full host, e.g. `acme.tenantry.localhost`.
- **Create workspace** submits. The review step is removed.
- A taken or invalid address shows the API's message on the Address field.
- Everything after submit is unchanged (the saga, ADR-0018).

### 2.3 Getting-started checklist (Tenantry › Home)

Shown to people with `members:invite` or `tenant:settings`.

| Step                     | Done when                                         | Action                                                          |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| Create a project         | `GET /api/projects` returns at least one          | a name field and **Create** on Home (the Projects create call)  |
| Invite a teammate        | more than one member, or at least one open invite | link to Admin `/people?invite=1`, which opens the invite dialog |
| Add your colour and logo | the workspace has a saved colour or logo          | link to Admin `/branding`                                       |

- Everything comes from endpoints the apps already call. Nothing new is stored on the server.
- A done step shows a check mark and no action.
- With all three done, the checklist isn't rendered.
- **Hide** sets `localStorage['tenantry.checklist.hidden.<userId>.<slug>'] = '1'`. Every read and write is wrapped in `try/catch`; when storage is unavailable, the checklist stays shown.
- Below the checklist, or alone when there's none, Home lists the five most recent projects and links to Projects.
- Members see only that list.

## 3. Small fixes

- **`pnpm dev:stack`:** ends with `Tenantry is up: http://tenantry.localhost[:port]`, the welcome page.
- **Company-login button name:**
  - `pnpm ops idp link` takes `--display-name`, which defaults to `<workspace name> company sign-in`. It is written to the identity provider's `displayName`, so the sign-in button shows it.
  - The seed passes `Acme Corp`.
  - A rerun with a different display name updates it. A rerun with no changes still reports nothing to change.
  - A move to Enterprise copies the display name with the rest (ADR-0025).
- **Page titles** match their menu entries (§1).

## 4. Not changing

- Existing API routes, permissions, tables and RLS policies (section 8 adds two endpoints and one table).
- What each moved page does. Section 8 restyles them; their behaviour and tests stay. People, Audit log, SCIM and Customer apps move as they are, keeping their tests.
- Production, deployment, load and docs-site work: 6b and 6c.

## 5. Decisions recorded

- **New ADR-0027, Tenantry and Admin:** the split by audience, the Advanced group, the member rule for the switcher, and the redirects.
- **ADR-0018:** an update for the welcome page and the one-screen signup.
- **ADR-0022:** an update for `--display-name`.
- **Docs:**
  - `docs/demo-script.md` is rewritten around the new flow (welcome page → demo workspace → checklist → Admin);
  - the README and `docs/SETUP.md` (§6);
  - CHANGELOG;
  - `docs/known-issues.md` gets its date bumped.

## 6. A product README, and setup in its own file

The README becomes the product page a visitor reads on GitHub. Developer set-up moves to `docs/SETUP.md`, linked from it.

### `README.md`, in this order

1. **Header** (centred):
   - the name, and a one-line tagline: "Multi-tenant sign-in, teams and branding for SaaS, built on Keycloak";
   - badges: CI status, licence (MIT), Keycloak 26.8, Node 22, TypeScript.
2. **A hero screenshot** of the welcome page or a branded workspace (light theme).
3. **The problem it solves**, in three or four sentences: every B2B SaaS needs per-customer sign-in, teams, roles, branding, company login and directory sync, and the big customers want a realm of their own. Tenantry shows one way to do all of it on Keycloak without leaking one tenant into another.
4. **Features**, grouped, each a short line with a screenshot where it helps:
   - **Workspaces:** signup, invites, roles, audit log.
   - **One sign-in, two apps:** SSO and single logout.
   - **Branding:** colour with a contrast check, logo, a branded login page.
   - **Company login:** an identity provider per verified domain.
   - **Enterprise:** a realm per customer, customer apps, SCIM, Keycloak console access, moving from Standard to Enterprise.
   - **Security settings:** two-step sign-in, passwords, sessions, lockout.
5. **How it keeps tenants apart:** the guarantees table, kept and shortened to the rows a reader cares about, with a link to the full list in `tests/isolation`.
6. **Architecture:** a Mermaid diagram (GitHub renders it): browser → Caddy → web, Admin and API → Keycloak and Postgres, with Standard (shared realm, organizations) and Enterprise (a realm each) shown side by side.
7. **Built with:** a row of technology badges with logos (shields.io and Simple Icons):
   - TypeScript, Node.js, NestJS, React, Vite;
   - IBM Carbon, Keycloak, Keycloakify, PostgreSQL, Drizzle;
   - Docker, Caddy, Turborepo, pnpm, Vitest.

   Each badge links to the project's site.

8. **Try it in five minutes:** three commands (`pnpm install`, `pnpm dev:stack`, `pnpm seed`), then "open the welcome page". The details and troubleshooting live in `docs/SETUP.md`.
9. **Documentation:** links to `docs/SETUP.md`, the guides, the ADRs, the demo script, known issues, CONTRIBUTING and AGENTS.
10. **Roadmap:** phases done and next, short. Then the **licence**.

### `docs/SETUP.md`

Everything a developer needs, moved from the README and expanded:

- prerequisites;
- the quick start;
- the addresses and ports, and changing them (`TENANTRY_HTTP_PORT`);
- the demo accounts (the password stays in `.env`, never in the file);
- the command table (from AGENTS.md);
- `pnpm dev` versus `pnpm dev:stack`;
- running the tests and isolation suite;
- resetting the stack;
- common problems (port taken, Docker not running, `.secrets` ownership on Linux).

### Screenshots

- Saved in `docs/images/` as PNG, light theme, desktop width, from the seeded stack.
- Each is under 300 KB, with alt text.
- They're taken during the 6a browser walkthrough, so they show the new UI. Signed-in shots need you to sign in in the browser pane.

## 7. Tenantry's own brand

Tenantry gets a logo and a small brand of its own, used wherever no workspace's brand applies.

### The mark and the logo

- **The mark:** five square tiles forming a **T**, each with clear space around it, and the tile where the bar meets the stem in the brand colour. Separate workspaces, one platform. (A first draft of four tiles in a square was dropped: it looked like the Windows logo.)
- **The logo:** the mark followed by the word "Tenantry" in IBM Plex Sans, semibold.
- **Colours:**
  - brand: Carbon Blue 60, `#0f62fe` (already the default workspace colour);
  - neutral: Gray 100, `#161616` on light and Gray 10, `#f4f4f4` on dark.
- **Hand-written SVG**, no raster sources. Every file has a `<title>` and is under 4 KB.

### Files (`packages/ui/assets/brand/`)

- `tenantry-mark.svg`
- `tenantry-logo.svg` and `tenantry-logo-dark.svg`
- `favicon.svg`, plus `favicon-32.png`, `apple-touch-icon.png` (180) and `icon-512.png`, rendered from the SVG by a script and committed
- `social-preview.png` (1280×640) for the GitHub repository's social preview. You upload it in the repository settings; it can't be set from the repository.

### Where it's used

- **The favicon and title** of web, Admin and the login theme. A workspace's own logo still replaces it in the header.
- **The header** of web and Admin when the workspace has no logo of its own: the mark before the workspace name.
- **The welcome page and the signup page:** the logo above the heading.
- **The login page with no workspace** (the apex sign-in and registration): the logo in place of the plain "Tenantry" text.
- **The README header:** the logo, as `<picture>` with light and dark sources.

### Brand notes

`docs/brand.md`: the mark's meaning, the two colours, the clear space (a quarter of the mark's width), minimum size (16 px), and what not to do (stretch, recolour, add effects).

## 8. Redesign, one menu, search and notifications (added after the first walkthrough)

The first signed-in walkthrough showed pages that read as bare: no icons in the menu, plain text headers, lists with no way to find anything, empty states that only say "No … yet". You asked for a modern, user-friendly redesign, one menu for both apps, search, and in-app notifications, all in 6a.

### 8.1 One menu (updates ADR-0027)

Both apps render the same side menu, built by `workspaceMenu(me, workspaces, app)` in `@tenantry/app-kit`:

| Section   | Items (Carbon icon)                                                                                               | Shown when                   |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| (top)     | Home (`Home`), Projects (`Folder`)                                                                                | `projects:read` for Projects |
| Workspace | People (`UserMultiple`), Branding (`ColorPalette`), Sign-in & security (`Security`), Audit log (`RecentlyViewed`) | as in §1                     |
| Advanced  | collapsed: Directory sync (`DataShare`), Customer apps (`Application`), Keycloak console (`Launch`, new tab)      | as in §1                     |

- An item that lives in the other app links to that app's address; the person stays signed in (ADR-0020). An item in this app uses the router.
- `NavItem` gains `section?: string` for the headings. The menu shows icons, and collapses to an icon rail at Carbon's `md` breakpoint.
- Members see Home and Projects only.

### 8.2 Redesign (Carbon components and tokens only)

- **Header:** a workspace badge (the workspace logo, or its first letter on the workspace colour) with the workspace name and the app's name ("Tenantry" or "Admin"); the search box; the notifications bell with an unread count; the app and workspace switchers; an account avatar with the person's initials.
- **Page header:** an optional Carbon icon before the title, a one-line description under it (§2's `description`), and the primary action on the right. Every page gets an icon and a description.
- **Shared pieces in `@tenantry/ui`:**
  - `EmptyState`: an icon, a headline ("Start your first project"), one line, and an action;
  - `StatTile` takes an optional icon;
  - `SetupCard`: a title, "N of M done", a Carbon `ProgressBar`, and one tile per step;
  - `Avatar`: initials on a neutral circle;
  - roles and statuses shown with Carbon `Tag`.
- **Lists** (People, Projects, Audit log, Customer apps): a `TableToolbarSearch` that filters the loaded rows; people with an avatar and their role as a tag; empty states through `EmptyState`.
- **Home:** "Good morning, <first name>" (by the browser's local time), "Here's what's happening in <workspace>.", the `SetupCard` (the §2.3 steps), stat tiles for People, Projects and Open invites (owners and admins; members see Projects only), and Recent projects.
- **Buttons and copy:** one primary button per view; sentence case; verbs first.
- **Login pages:** consistent spacing; the "Or sign in with" heading at the size of the page's other headings.

### 8.3 Search

- A search box in the header, also opened with Ctrl+K (Cmd+K on macOS), opens a Carbon modal with a text field and results in three groups: **Pages** (the menu items the person may see), **People** (from `/api/members`, by name or email) and **Projects** (from `/api/projects`, by name).
- Up to five results per group. The arrow keys move, Enter opens, Esc closes.
- No new endpoint: it filters what the person's own token can already read. A member finds people and projects, and no Admin pages.

### 8.4 Notifications (ADR-0028)

Built from the audit log when they are read; nothing new is written when something happens.

| Kind           | From                                                                                                             | Who sees it                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| About you      | `member.role_changed`, `console.granted`, `console.revoked` with you as the target                               | you                                  |
| Team           | `member.joined`, `member.removed`, `member.left`, `invite.revoked`, `scim.user_created`, `scim.user_deactivated` | owners and admins (`members:invite`) |
| Workspace      | `branding.updated`, `branding.logo_updated`, `app.registered`, `app.secret_rotated`, `tenant.migrated`           | owners and admins                    |
| Security       | `security.updated`, `scim.token_created`, `scim.token_revoked`, `idp.linked`                                     | owners (`tenant:settings`)           |
| Token expiring | the workspace's active SCIM token expires within 14 days (worked out when read)                                  | owners                               |
| Your invites   | open invites to your verified email address in other workspaces                                                  | you                                  |

- Your own actions are not shown to you.
- `GET /api/notifications` returns `{ items: [{ id, kind, title, body, href, createdAt, unread }], unread }`, newest first: the latest 30 matching audit entries from the last 30 days, plus the expiry and invite items.
- `POST /api/notifications/read` sets "read up to now" for this person in this workspace, in `notification_reads`: a new tenant table with forced RLS (migration 0006).
- **Other workspaces' invites:** a `security definer` SQL function, `open_invites_for_email(email)`, returns only the slug, name and role of active workspaces with an open invite to exactly that email (compared lower-cased). The API calls it only with the verified email from the token, and never when the email is unverified. It is the one read across workspaces outside the platform repository, and ADR-0028 records it.
- **The bell** (a Carbon `HeaderGlobalAction` and `HeaderPanel`): the unread count as a badge, the list with an icon per kind and the time ("5 min ago"), "Mark all as read", and each item links to its page. It refreshes every 60 seconds while the page is visible.

### 8.5 README

- **Built with** moves under the tagline and badges, before The problem.
- The problem gets a Mermaid diagram of the two tiers: Standard workspaces as organizations in the shared `platform` realm, Enterprise workspaces as a realm each, both behind the same guard, API and Postgres with row-level security.
- Screenshots are retaken after the redesign, at 1280 px wide in the light theme: welcome, Home, Admin › People, search, notifications, and the branded login.

### 8.6 Tests

- **app-kit:** `workspaceMenu` by role and app (items in the other app are full links; members see two items); search grouping, the permission filter, the keyboard; the bell's count, list, mark-read and refresh.
- **ui:** `EmptyState`, `SetupCard` (count and progress), `Avatar` initials, the header badge (logo or initial), nav sections and icons.
- **db:** `notification_reads` under RLS; `open_invites_for_email` returns only that email's open invites in active workspaces, never revoked or accepted ones, and nothing for another email.
- **api:** each rule in §8.4, your own actions left out, the 14-day expiry, mark-read, and no cross-workspace invites for an unverified email.
- **Isolation (new rows in the guarantees):** notifications never show another workspace's events; a member never sees owner or admin notifications; another workspace's invite shows only to its verified address.

## 9. Testing (sections 1 to 7)

Test-first, Vitest, next to the code.

- **web:**
  - Menu by permission; Patterns absent outside dev.
  - `/members` and `/audit` redirect to Admin.
  - Home: each checklist step's done rule, Hide (and storage throwing), members see no checklist.
  - Welcome page: Go input clean-up and error, demo tile hidden without `VITE_DEMO_WORKSPACES`.
  - Signup: the address is filled in from the name, editing the address stops it, the API error shows on the field.
- **portal:**
  - Menu by permission and tier; Advanced collapsed; console link only with `consoleUrl`.
  - Admin opens on the first allowed page.
  - Old paths redirect.
  - `/people?invite=1` opens the invite dialog.
  - The moved pages' existing tests pass under their new paths.
- **app-kit:** `appLinks` leaves out Admin for someone who may see no Admin page.
- **ops and keycloak-admin:** `idp link --display-name` default and update; the seed's second run changes nothing; the move copies the display name.
- **Unchanged:** the isolation suite, smoke, and the seed check run as in CI.
- **Brand:** the SVGs parse, have a `<title>` and stay under 4 KB; each app's `index.html` links the favicon; the header shows the mark only when the workspace has no logo; the login theme shows the logo without a workspace.
- **UI:**
  - ui-consistency finding-patterns runs before the first UI task;
  - a separate agent verifies the pages;
  - a browser walkthrough of the visitor path as an owner and as a member, in both themes and at phone width.

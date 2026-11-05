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
- No API route, permission, table or isolation test changes. The one Keycloak-facing change is the identity provider's display name.

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

| Menu                            | Path                                                              | Page                                                                                           | Shown when                 |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| People                          | `/people`                                                         | today's web Members page, moved unchanged (members, invites, the row menu with console access) | `members:read`             |
| Branding                        | `/branding`                                                       | unchanged                                                                                      | `tenant:settings`          |
| Sign-in & security              | `/security`                                                       | today's Security page, retitled                                                                | `tenant:settings`          |
| Audit log                       | `/audit`                                                          | today's web Audit log, moved unchanged                                                         | `audit:read`               |
| **Advanced** (group, collapsed) |                                                                   |                                                                                                | any child shown            |
| · Directory sync (SCIM)         | `/advanced/scim`                                                  | today's SCIM page                                                                              | `tenant:settings`          |
| · Customer apps                 | `/advanced/apps` (and `/advanced/apps/new`, `/advanced/apps/:id`) | today's Applications pages, retitled                                                           | `apps:read` and Enterprise |
| · Keycloak console              | external link                                                     | `me.consoleUrl`                                                                                | `me.consoleUrl` is set     |

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

- API routes, permissions, database, RLS and isolation tests.
- The login theme, apart from showing the display name, which it already does.
- How each moved page works inside. People, Audit log, SCIM and Customer apps move as they are, keeping their tests.
- Production, deployment, load and docs-site work: 6b and 6c.

## 5. Decisions recorded

- **New ADR-0027, Tenantry and Admin:** the split by audience, the Advanced group, the member rule for the switcher, and the redirects.
- **ADR-0018:** an update for the welcome page and the one-screen signup.
- **ADR-0022:** an update for `--display-name`.
- **Docs:**
  - `docs/demo-script.md` is rewritten around the new flow (welcome page → demo workspace → checklist → Admin);
  - README text is updated where it names pages;
  - CHANGELOG;
  - `docs/known-issues.md` gets its date bumped.

## 6. Testing

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
- **UI:**
  - ui-consistency finding-patterns runs before the first UI task;
  - a separate agent verifies the pages;
  - a browser walkthrough of the visitor path as an owner and as a member, in both themes and at phone width.

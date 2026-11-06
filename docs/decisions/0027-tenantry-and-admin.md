# ADR-0027: Tenantry and Admin, two apps split by who they are for

Status: Accepted · Date: 2026-11-08 · Updated: 2026-11-08 (one menu)

## Context

Phases 0–5 added pages to whichever app was being built at the time. By Phase 5 a first-time visitor met settings split across two apps with no rule behind it:

- members, roles and the audit log were in web;
- branding, security, SCIM and customer apps were in the portal.

There was also a developer page in the main menu, and IT-admin features sat on the same level as everyday ones. The two apps exist on separate origins on purpose, to show one sign-in carrying across apps (ADR-0020), so merging them would lose that.

## Decision

- **Tenantry** (`apps/web`, `<slug>.tenantry.localhost`) is the product people use:
  - Home, with a getting-started checklist for owners and admins and the latest projects;
  - Projects.
- **Admin** (`apps/portal`, `<slug>.portal.tenantry.localhost`) is everything about the workspace, in this order:
  1. People: members, invites, console access;
  2. Branding;
  3. Sign-in & security;
  4. Audit log.

  Below those sits **Advanced**, collapsed by default: Directory sync (SCIM), Customer apps (Enterprise), and the Keycloak console (a new tab, only for someone with console access).

- **Admin is for owners and admins.** Each page needs `members:invite`, `tenant:settings` or `audit:read`; Customer apps needs `apps:register` on an Enterprise workspace.
  - A member holds `members:read` and `apps:read`, but no Admin page is shown for them.
  - The app switcher lists Admin only for someone who may open it, so a member sees no switcher.
  - A member who opens Admin's address directly sees "You can't open Admin", with a link back to Tenantry.
- **Old addresses redirect**:
  - web `/members` → Admin `/people`, and web `/audit` → Admin `/audit`;
  - Admin `/applications…` → `/advanced/apps…`, and Admin `/scim` → `/advanced/scim`.
  - The customer-app test callback keeps `/applications/test-callback`, because registered redirect URIs name it.
- **The base domain** shows a welcome page with no sign-in. It offers "Create a workspace" (registration first, `prompt=create`), "Go to your workspace", and, when `VITE_DEMO_WORKSPACES` is set, demo workspaces.
- **No API change.** Both apps call `/api` on their own origin with the same token audience; permissions are checked by the API as before.

## Alternatives considered

- **One app with everything**: simplest to navigate, but it loses the single-sign-on-across-apps demonstration and a README guarantee.
- **Keep the split and tidy each page**: leaves the visitor to learn an arbitrary split.

## Consequences

- Members no longer have a page that lists their teammates; the API still lets them read the list.
- Bookmarks to the old addresses keep working through redirects.
- The demo's single-sign-on step becomes "open Admin" from the checklist, which a new owner does in their first minute.

## Update: one menu

Both apps now show the same side menu (`workspaceMenu` in `@tenantry/app-kit`): Home and Projects, then a **Workspace** section with People, Branding, Sign-in & security and Audit log, then **Advanced**. Each item has an icon. Items that live in the other app link to its address; sign-in carries over (ADR-0020). Members see Home and Projects only. Both headers also carry search (Ctrl+K) and the notifications bell ([ADR-0028](0028-notifications.md)).

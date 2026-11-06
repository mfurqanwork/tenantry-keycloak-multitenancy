# ADR-0018: Signup through Keycloak first, with a compensating saga

Status: Accepted · Date: 2026-11-02 · Updated: 2026-11-08 (Phase 6a)

## Context

A Standard tenant is a row in our database plus a Keycloak organization with three groups, the creator as owner, and the tenant's address registered on the SPA client. These span two systems with no shared transaction.

## Decision

- The person registers or signs in on the Keycloak login page first. Our API never sees a password.
- `POST /api/signup` (apex host, signed-in only) runs ordered steps, each with an undo where one is needed:
  1. insert the tenant as `provisioning` (a taken slug answers 409; a `failed` row is replaced);
  2. create the organization (alias and name = the slug);
  3. create the `owners`, `admins` and `members` groups;
  4. add the caller and put them in `owners`;
  5. add `<origin>/*` to `tenantry-web`'s redirect URIs and the origin to its web origins;
  6. in one transaction, write `tenant_identity`, set `active` and audit `tenant.created`.
- On any failure the completed steps are undone in reverse, the tenant is marked `failed`, and the API answers 502. A failing undo is logged for an operator, never thrown.
- Keycloak accepts a wildcard only at the end of a redirect URI, never in the host. So each tenant's origin is registered on the client at signup, instead of one `*.tenantry.localhost` entry.
- The Keycloak organization name is the slug, because Keycloak keeps organization names unique and display names are not. The display name lives in our `tenants` table.
- The `tenantry-backend` service account holds `manage-realm`, `view-users`, `manage-users` and `manage-clients`. That is the smallest set that passed every call against Keycloak 26.8.1.

## Alternatives considered

- Our own signup form that creates the Keycloak user: smoother, but our API would handle passwords.
- One wildcard redirect URI: not possible in Keycloak.

## Consequences

- A tenant client with thousands of redirect URIs may slow Keycloak; Phase 6 measures it.
- `manage-realm` and `manage-clients` are broad for one service account; Phase 6 narrows them with fine-grained admin permissions.
- Two API replicas could race on the client's redirect list. One process serialises its own edits; Phase 6 revisits this.

## Update (Phase 6a)

- The base domain's front page is a welcome page that needs no sign-in ([ADR-0027](0027-tenantry-and-admin.md)). "Create a workspace" goes to `/signup`, which signs in with `prompt=create`, so Keycloak opens its registration page first (it links to sign-in for people who already have an account).
- Signup is one screen: the workspace name and its address, filled in from the name until edited. "Create workspace" checks the address and then creates; a taken or reserved address is shown on its field. The saga after that is unchanged.

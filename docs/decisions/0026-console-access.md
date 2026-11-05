# ADR-0026: Scoped Keycloak console access for an enterprise workspace's own admins

Status: Accepted · Date: 2026-11-07

## Context

An enterprise customer's IT wants their realm's Keycloak admin console for day-to-day people work. The realm also holds what Tenantry depends on: product clients, flows, client policies, the `tenantry-*` groups and roles. An owner must never be locked out or taken over by an admin.

## Decision

- **Fine-grained admin permissions v2** on each enterprise realm (`adminPermissionsEnabled`). Permissions name the group `tenantry-console`:
  - Users: `view`, `manage`, `reset-password`, `manage-group-membership`;
  - Groups: `view`, `view-members`, `manage-membership`.
- **Owners are protected**: a second permission, with a negative policy on the same group, names the realm's current owners for `manage`, `reset-password`, `manage-group-membership`, `impersonate` and `map-roles`. Console users can see owners but not change them. Tenantry rewrites it with every change of who is an owner. A permission that names no user covers every user, so with no owner there is no such permission.
- **The console group is closed**: a negative permission on `tenantry-console` itself, so console users cannot hand out console access.
- **Out of reach**: clients, flows, realm settings, identity providers, role mapping, impersonation (probed on 26.8.1).
- **Getting in.** The console only starts for someone holding realm-management `query-users` and `query-groups`. Those are the composite of a plain realm role `tenantry-console-user`, made before permissions go on. Console access is that role plus membership of `tenantry-console`; the provisioner may still grant both once permissions are on.
- **Order**: once permissions v2 are on, Keycloak refuses the provisioner any realm-management role mapping, even one already held. So permissions go on last, after clients, groups, the console role and SCIM's client (`RealmScim.prepare`), and every mapping step maps only what is missing.
- **Who decides**: an owner, per person, for owners and admins only (`POST`/`DELETE /api/members/:userId/console`, `tenant:settings`). Our `tenant_console_access` row, the group and the role change in one request, audited `console.granted` / `console.revoked`. Losing the admin role, or leaving, revokes it.
- **Audit** of console edits is Keycloak's own admin events, with representations (template v4).

## Alternatives considered

- **realm-management roles for console users** (`manage-users`): no way to protect owners, and they could grant themselves more.
- **A realm-admin service account to grant access**: the only account Keycloak lets put people in a group carrying realm-management roles, but the provisioner cannot create one (it lacks `impersonation`), and it would be a full-admin credential per realm. The plain composite role made it unnecessary.
- **The query roles on every realm user's default roles**: the console stays safe, but Keycloak then guards everyone like an admin and refuses SCIM changes to them.

## Consequences

- Console users hold two admin query roles; Keycloak may refuse SCIM changes to them.
- Console edits are not in Tenantry's audit log.
- Every role change in an enterprise workspace also rewrites one Keycloak permission.

# ADR-0010: Versioned realm templates applied by our own code

Status: Accepted · Date: 2026-11-02 · Updated: 2026-11-03 (Phase 3), 2026-11-06 (Phase 5a), 2026-11-07 (Phase 5b)

## Context

Enterprise realms must stay consistent as the template evolves. The plan left open whether to use keycloak-config-cli or direct Admin API calls.

## Decision

Realm configuration lives in versioned JSON templates (`infra/keycloak/templates/enterprise-realm.vN.json` plus product-client templates). Our own TypeScript code in `packages/keycloak-admin` applies them through the Admin API, driven by `provision-enterprise-tenant` and `upgrade-enterprise-realms` (which has a dry run). Each realm records its template version in `tenant_identity`. Provisioning uses a master-realm service account that holds only `create-realm`; per-realm work uses that realm's `tenantry-backend` credential.

## Alternatives considered

- keycloak-config-cli: declarative and less code, but an extra process that is harder to drive per tenant from our API and to audit.

## Consequences

- We write and test diffing and idempotency ourselves.
- Provisioning is a product feature with audit entries, not an ops script.

## Update (Phase 3)

How the decision was built, where it differs from the text above:

- **Where the templates live.** `packages/keycloak-admin/templates/` (`enterprise-realm.v1.json` and `product-clients/`), not `infra/keycloak/templates/`. The API's Docker image is pruned to the packages it uses, so templates outside `packages/` would not ship with it.
- **Endpoints and a command, not scripts.** The API provisions and upgrades: `POST /api/platform/enterprise-tenants` and `POST /api/platform/enterprise-tenants/upgrade` (with `dryRun`), on the base domain only, for the `tenantry-ops` operator client only. `pnpm ops enterprise provision` and `pnpm ops enterprise upgrade [--tenant] [--dry-run]` call them. Each step can run again, so a failed run is finished by running it again; the audit log records `tenant.provisioning`, `tenant.created` and `tenant.upgraded`.
- **The provisioner account.** `tenantry-provisioner` holds only `create-realm` in the master realm. Keycloak gives it admin rights in each realm it creates and none in others (checked against `platform`: 403).
- **Two client policy profiles.** Public clients get PKCE and secure redirect URIs, `https` only. A stack running on `http` (local development) leaves the secure-redirect-URI check out: its `*.localhost` hosts are loopback names, and Keycloak refuses any loopback redirect but a literal `127.0.0.1` or `[::1]` once DNS answers for them, as it does on Linux hosts. Every client gets the implicit-grant and password-grant refusals. Every product client states `implicitFlowEnabled: false`, because Keycloak 26.8.1 answers 500 when that check meets an unset value.
- **The backend credential.** Each realm's `tenantry-backend` secret is made at provisioning and kept in a secrets store, never in Postgres ([ADR-0023](0023-realm-secrets.md)).
- **Upgrades compare only what the template sets.** A setting the template does not name is left alone, and a realm that cannot be read is reported and skipped; the others are still upgraded.

## Update (Phase 5a)

- **Template v3.** It adds the second sign-in step (`twoStep`, default `optional`, set on the built-in browser flow's "Browser - Conditional 2FA" subflow) and the mapped groups `tenantry-members` and `tenantry-admins`, with client-role mappings to `tenantry-api` `member` and `admin`. `ensureGroups` makes them on provision and upgrade.
- **The tenant's own settings are part of the template.** An owner's security settings (`tenant_security`: two-step sign-in, password policy, session times, lockout) are applied to the realm on save, and merged into the template before an upgrade compares or applies, so they are never reported as drift and never undone. A change made by hand in the Keycloak console still is.
- **Required two-step is the authenticator app.** Keycloak 26.8.1 refuses a required subflow of alternatives, so "required" sets OTP required and the other methods off.

## Update (Phase 5b)

- **Template v4** turns Keycloak's admin events on (with representations) and adds the group `tenantry-console` and the realm role `tenantry-console-user` ([ADR-0026](0026-console-access.md)).
- **Fine-grained admin permissions v2 go on last.** Once on, Keycloak refuses the provisioner any realm-management role mapping, even one already held, so they are not a template key: `RealmConsole.ensurePermissions` turns them on after clients, groups and SCIM's client, and every mapping step maps only what is missing. An upgrade does the same.
- `RealmProvisioner.deleteRealm` removes a half-built realm when a move is aborted ([ADR-0025](0025-standard-to-enterprise.md)).

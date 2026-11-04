# ADR-0025: Moving a Standard workspace into a realm of its own, through a bridge

Status: Accepted · Date: 2026-11-07

## Context

A Standard workspace is an organization in the shared `platform` realm. When it outgrows that, it moves to Enterprise: a realm of its own (ADR-0001, ADR-0010). Its people must keep their Tenantry user ids and data (ADR-0007), and they should not all have to set a new password. Keycloak's admin API never returns password hashes, nor an identity provider's client secret.

## Decision

- **An operator moves it**: `pnpm ops enterprise migrate --tenant <slug> [--dry-run]`, calling operator-only API endpoints, like provisioning. Every step checks Keycloak and the `tenant_migrations` row before acting, so a failed run is finished by running it again.
- **The freeze.** The tenant's status becomes `migrating`. People, roles, invites and branding answer 409 until the cut-over. Reads, projects and sign-in through the shared realm keep working.
- **The realm** is built by the provisioning steps (template v4), with SCIM's client and the console permissions last (ADR-0026).
- **People** are created in the new realm with the same email, names and role, email verified and no email sent; an existing account with that email (any case) is reused. Each gets a second `identities` row, from the new issuer and Keycloak id to the same `users.id`. The shared-realm identity stays: the person may be in other workspaces.
- **The bridge.** A confidential client `tenantry-bridge-<slug>` in `platform` (its secret in the secrets store) and an OIDC identity provider `tenantry-account`, "Continue with your Tenantry account", in the new realm. Every moved person is pre-linked to their shared-realm account, so their old password works. The provider's first-login flow is Keycloak's "Deny access" alone: anyone not pre-linked is refused, and nobody with a shared-realm account can make themselves an account in the customer's realm.
- **Company logins** are copied with their settings and the secret `pnpm ops idp link` kept in the secrets store (`platform/idp-<alias>`; ADR-0022, updated). One linked before 5b has no kept secret: it is copied switched off and named, and `pnpm ops enterprise idp-secret` gives it its secret. People who used one are pre-linked to it.
- **Open invites** are sent again from the new realm; their rows stay, as enterprise invites keep theirs.
- **The cut-over**, after every copy: the tenant becomes enterprise and active, with the new realm and issuer, and its organization id cleared. Shared-realm tokens for it then get 401. Audit `tenant.migrated` carries counts only.
- **Finish**, when the operator chooses: the bridge and its client go, and the organization is deleted from `platform`. **Abort**, before the cut-over only: the half-built realm and bridge client go, and the workspace is Standard again.

## Alternatives considered

- **A set-password email for everyone.** Simple, but every person must act before they can sign in again.
- **Copying credentials through a realm export or the database.** Needs Keycloak's database or an offline export, outside `packages/keycloak-admin`, and a stop.
- **Keeping the workspace in the shared realm with a flag.** Not a realm of its own: none of what Enterprise is for.

## Consequences

- After the cut-over there is no way back.
- A company's identity provider must accept the new realm's broker address before its people can use it there.
- The platform `tenantry-backend` gains `view-identity-providers` (read only), to copy company logins' settings.

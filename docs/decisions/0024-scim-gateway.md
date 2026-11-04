# ADR-0024: SCIM through a Tenantry gateway in front of Keycloak's native SCIM

Status: Accepted · Date: 2026-11-06 · Refines [ADR-0012](0012-scim.md)

## Context

ADR-0012 chose Keycloak's native SCIM for enterprise realms. Keycloak 26.8.1 serves it at `/realms/<realm>/scim/v2/…` once the realm's `scimApiEnabled` is on, for a realm token whose audience is `<issuer>/scim/v2` from a client holding `manage-users`, `view-users`, `query-users` and `query-groups`.

A directory (Entra ID, Okta) needs one long-lived bearer token. Keycloak cannot issue one: a client's access token lifetime is capped by the realm's SSO session maximum (10 hours in our template), so any token it hands out expires within a working day. Native SCIM also knows nothing of Tenantry's roles: a person it creates holds no `tenantry-api` role and cannot use Tenantry.

## Decision

- **A gateway.** The API serves `https://<slug>.<base>/scim/v2/…` (Users, Groups and the discovery resources). It checks a Tenantry SCIM token, then forwards the call to the realm's native SCIM with a 5-minute token of a per-realm `tenantry-scim` client (client credentials; its secret in the secrets store, ADR-0023). Keycloak's status and body come back as they are, with its address in `Location` and `meta.location` swapped for the gateway's.
- **The token.** `tnt_scim_` and 32 random bytes in base64url, shown once and stored as a SHA-256 hash in `tenant_scim_tokens` (forced row-level security), with an expiry of 90 days, 180 days or 1 year. One active token per workspace: a new one revokes the old. The first token turns the realm's SCIM on and creates `tenantry-scim`; revoking turns it off.
- **Trust.** `/scim/v2` uses its own `ScimTokenGuard`, never `TenantAuthGuard`. The host picks the workspace, and the token is looked up only inside it, so another workspace's token is unknown there. A person's token never works on `/scim`, and a SCIM token never works on `/api`. Errors are SCIM error bodies: 401, 403, 404, 413 (bodies over 1 MB), 502.
- **Paths.** Only `Users`, `Groups`, `ServiceProviderConfig`, `Schemas` and `ResourceTypes`, at most one id deep, are forwarded. Each segment is decoded once and refused if it is `.`, `..`, empty, or holds `/`, `\` or `%`, then encoded again. Keycloak's URL parser would otherwise resolve an encoded `../` into the realm's admin API, which the gateway's token can reach.
- **Owners.** A write to a person who holds `owner` (PUT, PATCH or DELETE) is refused with 403 before it reaches Keycloak.
- **Roles.** Each workspace has a default role for SCIM people (`member` or none). After Keycloak accepts a create, a PUT or a PATCH of an active person, the gateway grants it (idempotent). The groups `tenantry-members` and `tenantry-admins` exist in every realm, mapped to the `tenantry-api` roles, so membership gives the role and leaving takes it back. A directory delete of either group empties it instead. Owners are never managed by SCIM.
- **Audit.** `scim.token_created` and `scim.token_revoked` carry the expiry only. `scim.user_created`, `scim.user_updated`, `scim.user_deactivated`, `scim.group_changed` and `scim.role_grant_failed` have no actor and `via: 'scim'`, target the Keycloak id, and carry nothing about the person.
- **Security settings** (two-step sign-in, passwords, sessions, lockout) live in `tenant_security`, are applied to the realm on save through the provisioner account, and are merged into the template before an upgrade compares, so a tenant's own settings are never reported as drift.

## Alternatives considered

- **Hand the directory a Keycloak token.** It would expire within the SSO session maximum, and raising that for the whole realm weakens every person's sessions.
- **Our own SCIM server.** Full control, but we would own the SCIM protocol, filters and patch semantics, which Keycloak already does.
- **A Keycloak extension that issues long-lived tokens.** A custom provider to build, ship and upgrade with every Keycloak release.

## Consequences

- One extra hop per call, and the API has to be up for directory sync.
- `tenantry-scim` holds user and group management in each realm, nothing more; the gateway's token for it lives five minutes.
- A person the directory creates must verify their email before signing in with a password, because the realm requires it and SCIM does not verify it. Sign-in through the customer's own identity provider avoids this.
- Two-step "required" means the authenticator app (OTP): Keycloak 26.8.1 refuses a required step made of alternatives.

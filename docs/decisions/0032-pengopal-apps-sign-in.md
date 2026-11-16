# ADR-0032: Pengopal's own apps sign in with Tenantry

Status: Accepted · Date: 2026-11-16

## Context

PengOPA, Pengopal's policy app, is the first Pengopal product offered to Tenantry workspaces. Its people should sign in once, land in the PengOPA workspace that matches their Tenantry workspace with a matching role, and sign out of both together.

Customer apps (ADR-0011) are an Enterprise feature, registered by a workspace in its own realm. PengOPA is different: it is Pengopal's product, for Standard workspaces, which all live in the `platform` realm.

## Decision

- **One confidential client per Pengopal app in the `platform` realm**, starting with `pengopa`. Authorization code with PKCE S256; no direct grants, implicit flow or service account. The realm file carries it, so a deploy brings it (ADR-0029).
- **The workspace comes from Keycloak's organization picker.** PengOPA asks for the `organization` scope. A person in one workspace goes straight through; a person in several picks one.
- **Roles come from the organization's groups, in the ID token.** The client has the `organization groups` mapper with `id.token.claim` on, so PengOPA reads `organization.<alias>.groups` (`/owners`, `/admins`, `/members`) from the ID token, never `realm_access` (hard rule 2). PengOPA maps owners to Owner, admins to Editor and members to Viewer.
- **Its tokens are refused by Tenantry's API.** The client has no `tenantry-api` audience mapper, so an access token issued to PengOPA gets 401 on `/api` (a guarantee in `tests/isolation/src/pengopa.test.ts`).
- **Sign-out reaches both apps.** PengOPA signs out through Keycloak's end-session endpoint with `id_token_hint`, which ends the Keycloak session; Tenantry's apps notice as in ADR-0020. When someone signs out of Tenantry, Keycloak calls PengOPA's back-channel logout URL (`backchannel.logout.session.required` on, so the logout token carries `sid`), and PengOPA deletes those sessions at once.
- **Secrets.** Production takes the client secret as `PENGOPA_CLIENT_SECRET` and PengOPA's address as `PENGOPA_URL` (default `https://opa.pengopal.com`) from the VM's `.env`. The deploy refuses to start without the secret, so the dev secret never reaches production.

## Alternatives considered

- **A customer app in each workspace's realm (ADR-0011):** made for an Enterprise customer's own apps, one registration per workspace. Standard workspaces share one realm and should not each register Pengopal's product.
- **Roles in the access token, read from Tenantry's `/api/me`:** a second call on every sign-in, and PengOPA's token would need Tenantry's audience, which the guarantee above forbids.
- **Front-channel logout:** blocked across sites by third-party cookie rules, as ADR-0020 found.

## Consequences

- ADR-0020 rejected back-channel logout for Tenantry's own apps because they are SPAs with no server session to end. PengOPA has a server session, so back-channel logout fits it, and its sessions end the moment Tenantry signs out. If PengOPA is down at that moment, Keycloak does not retry, and that session lasts until it expires.
- **Standard workspaces only.** An Enterprise workspace has its own realm and issuer, so a Pengopal app would have to ask which workspace before redirecting. That needs a product client in the enterprise template (ADR-0010) and is left for later.
- Someone removed from a Tenantry workspace keeps their PengOPA membership until a PengOPA owner removes it; they can no longer pick that workspace when signing in.
- A new Pengopal app is one more client in the realm file, one more secret, and one more line in `scripts/lib/prod-realm.mjs`.
- Setup for both apps: [docs/guides/pengopal-apps.md](../guides/pengopal-apps.md).

# ADR-0011: Customer apps: Enterprise tier only

Status: Accepted · Date: 2026-11-02 · Updated: 2026-11-03 (Phase 4)

## Context

Enterprise customers want to plug their own apps into Tenantry's login. In the shared realm, a customer's client could see users of other tenants.

## Decision

Only enterprise tenants can register apps. Registration goes through our API, which validates redirect URIs (HTTPS only except localhost, no wildcard hosts, a cap per tenant). Keycloak client policies in the realm template enforce the same rules again. Secrets are shown once and never stored in our database.

## Alternatives considered

- Allow apps in the shared realm with a membership authenticator: possible later, deferred.

## Consequences

- Five app types are supported (web, SPA, native, machine-to-machine, SAML).
- Connection details and snippets are generated per realm.

## Update (Phase 4)

How the decision was built, where it differs from the text above:

- **Four app types.** Web, single-page, mobile or desktop, and machine to machine. SAML apps wait for a later phase.
- **Our table is the record; Keycloak holds the client.** `tenant_apps` (forced row-level security) keeps the type, name and URIs, never a secret. The client is written in the same request, through `RealmApps` and the realm's `tenantry-backend` account; if the row cannot be written, the client is removed again. `RealmApps` changes only clients marked `tenantry.app`, so our product clients are out of its reach.
- **URI rules.** `https` with a host; `http` only on `127.0.0.1` or `[::1]` (Keycloak refuses `localhost` names over `https`); custom schemes with a dot for mobile and desktop apps; no `*` in a host, no fragment, at most 10 per list; a cap of 20 apps per workspace. One set of rules in `@tenantry/auth` serves the API and the portal.
- **Keycloak checks again.** Realm template v2 applies the secure-redirect-URI check to every client, not only public ones. Keycloak 26.8.1 refuses plain `http` and a bare `*` there; it lets `https://*.host/cb` through but treats the `*` literally, so such a host never matches. On a stack served over `http` (local development) the check is left out (ADR-0010 update).
- **A customer app's token is not ours.** Customer clients have no role scope, so their tokens carry neither our audience nor workspace roles, and the guard accepts enterprise tokens only from `tenantry-web` and `tenantry-portal`.
- **Secrets shown once.** Registering and rotating return the secret in the response; the portal shows it and keeps it nowhere. A machine-to-machine token check takes a pasted secret and keeps nothing.
- **Test sign-in.** Clients people sign in to also list the portal's `/applications/test-callback`. Public clients finish the sign-in and show the claims; a web app's test stops at the code.
- **Operators.** `GET`/`POST /api/platform/enterprise-tenants/:slug/apps` and `.../apps/:id/secret`, behind `pnpm ops apps`, audited as `via: ops`.

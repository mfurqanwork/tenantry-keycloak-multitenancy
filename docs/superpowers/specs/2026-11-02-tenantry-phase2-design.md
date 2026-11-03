# Tenantry — Phase 2 design: SSO across apps, branding, company login → v0.1

Date: 2026-11-02 · Status: draft for review

## Purpose

Phase 2 makes Tenantry demonstrable end to end and closes the first public release, v0.1. A person signs in once and opens both apps. They switch between workspaces they belong to, and log out of both from either. Each tenant's logo and colour appear in the apps and on the Keycloak login page. An admin can link the company's own identity provider once the company proves it owns its email domain.

The domain design comes from the project plan doc ("Phase 2", "Design system → Tenant branding"). This spec adds the decisions that doc leaves open. What still does not work is tracked in `docs/known-issues.md`.

## Decisions taken for this phase

| Topic                    | Decision                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single logout            | Keycloak session check, not back-channel. Logging out ends the Keycloak session. The other app finds out on its next token refresh or when its tab regains focus, and signs out. ADR-0020.                                                                                                                                |
| Silent sign-in           | Redirect-based: a signed-in Keycloak session makes the authorization redirect return at once. Expired access tokens are renewed with the refresh token; a failed refresh means the session is over. No iframes.                                                                                                           |
| Second app               | `apps/portal`, the tenant's admin console, at `<slug>.portal.<base domain>` with its own Keycloak client `tenantry-portal`. Both apps show an app switcher.                                                                                                                                                               |
| Tenant switching         | A workspace switcher in both apps' headers lists every workspace the user belongs to (from Keycloak) and goes to that workspace's address, where SSO signs them in.                                                                                                                                                       |
| Login theme              | Keycloakify 11 (React) with Carbon styles, built into a JAR that the Keycloak image loads. ADR-0021.                                                                                                                                                                                                                      |
| Tenant on the login page | The first login page's URL carries `redirect_uri`; the theme reads the tenant slug from its host and keeps it for the tab in `sessionStorage`. With no tenant, the page shows Tenantry's own brand.                                                                                                                       |
| Branding                 | A logo (PNG, JPEG or WebP, at most 256 KB) and one colour. The colour must reach 4.5:1 contrast with white; otherwise 422 with the nearest darker shade that does. Hover and active shades are derived. A new pure-TypeScript package `@tenantry/brand` holds the colour maths for the API, the apps and the login theme. |
| Company login            | Operator commands in a new `apps/ops` CLI: claim a domain, verify its DNS TXT record, link an OIDC identity provider. Linking refuses an unverified domain. Locally, a Keycloak realm `corp-demo` plays the company's IdP and a CoreDNS container answers TXT lookups. ADR-0022.                                          |
| Seed and demo            | `pnpm seed` creates demo tenants, users and branding. `docs/demo-script.md` is the two-minute walkthrough a person records.                                                                                                                                                                                               |
| Release                  | `CHANGELOG.md`, and an annotated tag `v0.1.0` created locally after the merge. The person pushes it.                                                                                                                                                                                                                      |

## Exit criteria

1. After signing in at `acme.tenantry.localhost`, opening `acme.portal.tenantry.localhost` shows the portal signed in, with no login page.
2. A user in two workspaces switches between them from the header, without a login page.
3. Signing out in either app returns the other app to the login page as soon as its tab is focused.
4. Acme's logo and colour appear in both apps and on the Keycloak login page for `acme`. A colour below 4.5:1 is refused with a suggested shade.
5. After `ops domain claim` and `ops domain verify` succeed for `acme.test`, `ops idp link` links `corp-demo`. Then `alice@acme.test` signs in to `acme` through it. Linking before verification is refused.
6. `pnpm seed` then `docs/demo-script.md` runs the whole demo on a fresh clone.
7. The README rows "Logout in one app" and "Domain link without verified DNS record" are `tested`. `pnpm lint typecheck test build` and `pnpm test:isolation` pass, locally and in CI.

Out of Phase 2: the hosted demo, the video and the launch post (tracked in `docs/known-issues.md`); SAML identity providers; self-service domain claiming in the portal UI (operators only, by script); a custom theme for the account console.

## Code structure (additions)

```
packages/brand/               colour parsing, contrast ratio, darkerUntilContrast, derived shades (no dependencies)
apps/portal/src/features/     dashboard, branding (SettingsPage), switcher
apps/login-theme/             Keycloakify + Carbon; reads the tenant from redirect_uri; builds a JAR
apps/ops/                     TypeScript CLI: seed, domain claim|verify, idp link; uses @tenantry/db and @tenantry/keycloak-admin
apps/api/src/modules/branding/  GET (public, by slug) and PUT branding, POST logo, GET logo
apps/api/src/modules/workspaces/ GET /api/me/workspaces
packages/ui/src/shell/        app switcher and workspace switcher in AppShell; applyBrand implemented
infra/dns/                    CoreDNS Corefile and a zone for *.test
infra/keycloak/corp-demo-realm.json   the stand-in company IdP
```

The web and portal apps share their sign-in, API and `useMe` code. That code moves from `apps/web/src/lib` to a new `@tenantry/app-kit` package that both apps import. Only the pages stay per app.

## Data model (migration 0002)

| Table / change              | Columns                                                                                    | Access              |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| `tenants.branding` (exists) | `{ primaryColor: string \| null, logoVersion: number \| null }`                            | platform repository |
| `tenant_logos`              | tenant_id (pk), content_type, bytes (bytea), updated_at                                    | row-level security  |
| `tenant_domains`            | id, tenant_id, domain (unique where verified), verification_token, verified_at, created_at | row-level security  |
| `tenant_idps`               | tenant_id, alias (unique), domain_id, created_at                                           | row-level security  |

## API

| Endpoint                          | Auth                           | Does                                                                                                             |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/tenants/:slug/branding` | public, CORS for the auth host | `{ name, primaryColor, logoUrl }` for the login theme and the apps before sign-in                                |
| `GET /api/tenants/:slug/logo`     | public                         | The logo bytes with their content type, `Cache-Control` tied to `logoVersion`                                    |
| `PUT /api/branding`               | `tenant:settings`              | `{ primaryColor }`, validated with `@tenantry/brand`; 422 `{ suggestion }` below 4.5:1; audit `branding.updated` |
| `POST /api/branding/logo`         | `tenant:settings`              | multipart, at most 256 KB, type checked by magic bytes; audit `branding.logo_updated`                            |
| `DELETE /api/branding/logo`       | `tenant:settings`              | removes the logo                                                                                                 |
| `GET /api/me/workspaces`          | tenant route                   | `[{ slug, name, current }]` from Keycloak's organizations for the user, joined to active tenants                 |

Host rule change: `<slug>.portal.<base domain>` is a tenant host too, for the same tenant as `<slug>.<base domain>`. Signup registers both origins: web on `tenantry-web`, portal on `tenantry-portal`. Existing tenants get theirs from `ops tenants sync-origins`.

Quick fixes from `docs/known-issues.md` in this phase: a Keycloak outage answers 502 everywhere; a member can leave a workspace (`DELETE /api/members/me`, refused for the last owner); AGENTS.md hard rule 2 wording; the web UI pass (audit targets show the email or project name, breadcrumbs use the router, "Load more" shows a spinner).

## Single logout and session checks

- `@tenantry/oidc-client`: on `visibilitychange` to visible, and before using an expired access token, the client refreshes. A failed refresh clears the user and starts sign-in, which shows the Keycloak login page because the session is gone.
- "Sign out" calls Keycloak's end-session endpoint with `id_token_hint` and `post_logout_redirect_uri` set to the app's own address.
- The guarantee test in `tests/isolation`: sign in, log out through the end-session endpoint, then a refresh with the same session's refresh token fails (`invalid_grant`). A unit test in `oidc-client` covers "a failed refresh signs the app out".

## Branding

- `@tenantry/brand`: `parseHex`, `contrastRatio(a, b)`, `meetsContrast(hex, '#ffffff', 4.5)`, `darkerUntilContrast(hex)` (darkens in small steps of HSL lightness until it passes), `brandTokens(hex)` → `{ interactive, hover, active, focus, link }`.
- `applyBrand(tokens)` in `@tenantry/ui` sets Carbon's CSS custom properties: `--cds-interactive`, `--cds-button-primary`, `--cds-button-primary-hover`, `--cds-button-primary-active`, `--cds-link-primary`, `--cds-focus`, `--cds-border-interactive`. It does this on the page body only; the header keeps the g100 zone.
- The portal's Branding page is a SettingsPage. It has a colour field with a live preview of a primary button and a link, a logo uploader (Carbon `FileUploaderDropContainer`), and the save bar. A refused colour shows the API's suggestion with a "Use this colour" button.
- The login theme fetches `/api/tenants/<slug>/branding` from the tenant's own web address and applies the same tokens.

## Company login (operators)

Commands run as `pnpm ops <command>`. They connect with `DATABASE_URL` and the `tenantry-backend` credentials, like the API:

1. `domain claim --tenant acme --domain acme.test` stores a random token and prints the record to create: `_tenantry-verify.acme.test TXT "tenantry-verify=<token>"`.
2. `domain verify --tenant acme --domain acme.test` resolves TXT through `TENANTRY_DNS_SERVER` (the local CoreDNS in dev; the system resolver when unset) and sets `verified_at` when the token matches. A domain verified by another tenant is refused.
3. `idp link --tenant acme --domain acme.test --alias acme-corp --issuer <url> --client-id <id> --client-secret <secret>` refuses unless the domain is verified for this tenant. It creates an OIDC identity provider in the platform realm, links it to the organization with the domain, and turns on redirect-by-email-domain. It audits `idp.linked`.

Locally, `infra/dns` runs CoreDNS on `127.0.0.1:1053` with a zone for `test`. `pnpm ops dns set-txt <name> <value>` (dev only) writes the record. The `corp-demo` realm has a confidential client for Tenantry and the user `alice@acme.test`.

The guarantee test: `idp link` for a claimed but unverified domain exits non-zero and creates nothing in Keycloak.

## Seed and demo

`pnpm seed` (idempotent) creates:

- `acme` (blue) and `globex` (green);
- an owner, an admin and a member in each;
- `pat`, who belongs to both workspaces;
- the `corp-demo` link for `acme.test`.

Passwords come from `SEED_PASSWORD` in `.env.example`. These are local test accounts only. `docs/demo-script.md` walks through signup, SSO across both apps, switching, branding, company login and single logout in about two minutes.

## Testing

| Layer                        | Adds                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit                         | `@tenantry/brand` maths; `applyBrand`; oidc-client session-check behaviour; the switchers; the branding page                 |
| Integration (API, Postgres)  | branding endpoints including the 422 suggestion and magic-byte checks; workspaces; host rule for the portal; leave workspace |
| Contract (fake and Keycloak) | `listUserOrganizations`, `createOidcIdentityProvider`, `linkIdentityProvider`, client-specific origins                       |
| Isolation (whole stack)      | single logout; unverified domain link refused; another tenant's branding cannot be changed (403)                             |
| Login theme                  | Keycloakify's Storybook-free test render of the login page with and without a tenant                                         |

## Risks

| Risk                                                          | Mitigation                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Keycloakify's build needs Maven, and Docker builds get slower | Maven 3.9 and JDK 21 are on the dev machine for host builds; the Keycloak image builds the JAR in a Maven stage. The plan's first task spikes both; if it fails, the person decides the fallback (ADR-0021) |
| The login page loses `redirect_uri` after a failed submit     | The slug is kept in `sessionStorage` from the first page; without one, the Tenantry brand shows                 |
| Organization IdP redirect-by-domain differs in Keycloak 26.8  | The contract test pins the calls against the real server first                                                  |
| CoreDNS adds a container to the dev stack                     | Dev only, about 10 MB, loopback only                                                                            |

# Changelog

All notable changes to Tenantry. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- The first deploy on the 1 GB VM gave up while Keycloak was still waking from swap: the API now has a few minutes to report healthy.
- A release stops at once, with a clear message, when its repository variables are missing.

## [0.6.0] - 2026-11-10

Phase 3: Enterprise tenants. Phase 4: Customer applications. Phase 5a: SCIM and security settings. Phase 5b: moving to Enterprise, and console access. Phase 6a: a simpler Tenantry. Phase 6b: live on Azure.

### Added (Phase 6b)

- The live demo on one VM (ADR-0029): `infra/prod/compose.prod.yml`, Caddy with wildcard certificates through Cloudflare, Keycloak in production mode, production realms generated from the dev ones, and email relayed to Resend through an internal Mailpit. `docs/guides/deploy-azure.md` is the setup.
- One product version and releases (ADR-0030): `pnpm release <version>`, a CI check for a line under Unreleased, and a `release.yml` that tests a version tag, publishes the images and a GitHub Release, deploys and checks the live site.
- The running version in `/api/health` and the account panel.
- Demo sign-ins on the welcome page, when the build has a demo password. The live demo is rebuilt on each release and reset every night.

### Changed (Phase 6b)

- The API, migration, web and portal images run as a normal user.
- `pnpm ops seed` can run inside the production network, with no CoreDNS and no example app.

### Added (Phase 6a)

- One menu for Tenantry and Admin, with icons and a Workspace section; Admin's pages open in Admin from Tenantry's menu.
- Search in the header (Ctrl+K) across pages, people and projects, limited to what the person may see.
- Notifications (ADR-0028): a bell with an unread count, read from the audit log by role, a 14-day warning for a directory sync token, and invites from other workspaces to a verified email. `GET /api/notifications`, `POST /api/notifications/read`, `notification_reads` and `open_invites_for_email` (migration 0006).
- A redesigned look on Carbon: a workspace badge and initials avatar in the header, the theme choice in the account menu, page icons and descriptions, a greeting and setup card on Home, number tiles, search in every list, role tags, avatars and empty states.

- A welcome page on the base domain, with no sign-in: Create a workspace (registration first), Go to your workspace, and demo workspaces from `VITE_DEMO_WORKSPACES`.
- Home in Tenantry, with a getting-started checklist for owners and admins (create a project, invite a teammate, add your colour and logo) and the latest projects.
- Tenantry's own brand: the T-of-tiles mark, the logo, favicons and a social-preview image (`packages/ui/assets/brand`, `docs/brand.md`, `pnpm brand:icons`). The header shows the mark when a workspace has no logo, and the login page shows the logo when no workspace applies.
- `pnpm ops idp link --display-name`: the company-login button shows a name, not the alias.
- `docs/SETUP.md`, with everything a developer needs; the README is now a product page.
- ADR-0027.

### Changed (Phase 6a)

- The portal is now **Admin**, for owners and admins (ADR-0027): People (moved from web's Members), Branding, Sign-in & security, Audit log (moved from web), and a collapsed Advanced group with Directory sync (SCIM), Customer apps (`/advanced/apps`) and the Keycloak console. Old addresses redirect. Members see no Admin and no app switcher.
- Tenantry (web) has Home and Projects only. The Patterns page is in development builds only.
- Signup is one screen.
- `pnpm dev:stack` prints the welcome page's address.
- `@tenantry/ui`: nav groups and external links in `AppShell`, an optional `description` under a page title, and `WizardPage` without a progress bar for one step.

### Added (Phase 5b)

- Moving a Standard workspace into a realm of its own (ADR-0025): `pnpm ops enterprise migrate --tenant <slug> [--dry-run | --finish | --abort]` and the operator routes behind it. People keep their Tenantry accounts through a second identity, their roles, projects and audit log; open invites are sent again; company logins move with the secret kept at link time. The first sign-in uses "Continue with your Tenantry account", a bridge that refuses anyone not moved. `pnpm ops enterprise idp-secret` for a company login linked before 5b. `tenant_migrations` (migration 0005).
- Console access (ADR-0026): owners let owners and admins into their realm's Keycloak console for people and groups, from the Members page; the portal dashboard links console users to it. Owners cannot be changed from the console, and nobody can hand out console access there. `POST`/`DELETE /api/members/:userId/console`, `tenant_console_access` (migration 0005), `consoleUrl` on `/api/me`.
- Realm template v4: admin events on, fine-grained admin permissions v2 turned on after set-up, the `tenantry-console` group and role.
- `docs/guides/move-to-enterprise.md`.
- Guarantee tests: a moved person signs in through the bridge as the same user, a stranger is refused there, the shared realm's token stops working, and a console user cannot change an owner, hand out console access, or reach clients, the realm or another realm.

### Changed (Phase 5b)

- `pnpm ops idp link` keeps the company login's secret in the secrets store.
- The platform `tenantry-backend` may read identity providers' settings (`view-identity-providers`); `pnpm dev:stack` gives it to stacks set up before.
- Realm set-up maps only the roles a realm does not hold yet; SCIM's client is made before admin permissions go on.

### Added (Phase 5a)

- Security settings for enterprise workspaces: two-step sign-in (off, optional, required), password length, history and expiry, session idle and maximum times, and lockout. `GET/PUT /api/security`, the portal's Security page, `tenant_security` (migration 0004), applied to the realm on save and audited as `security.updated`.
- Directory sync over SCIM through a Tenantry gateway at `https://<slug>.<base>/scim/v2` (ADR-0024): long-lived `tnt_scim_` tokens kept as hashes in `tenant_scim_tokens`, one active per workspace, with `GET /api/scim`, `POST/DELETE /api/scim/token` and `PUT /api/scim/default-role`, and the portal's Directory sync (SCIM) page.
- A default role for people the directory creates, and the groups `tenantry-members` and `tenantry-admins` that give roles; the Members page shows roles held through them.
- Realm template v3: the second sign-in step and the mapped groups.
- `docs/guides/connect-scim.md` for Entra ID and Okta.
- Guarantee tests: another workspace's SCIM token, a person's token on `/scim` and a SCIM token on `/api`, a revoked token, SCIM people only in their own realm with the default role, and required two-step stopping a password-only sign-in.

### Changed (Phase 5a)

- Realm upgrades merge each tenant's own security settings into the template, so they are not reported as drift.
- Caddy sends `/scim/*` on tenant hosts to the API.

### Added (Phase 4)

- Customer apps for enterprise workspaces: web, single-page, mobile or desktop, and machine to machine (ADR-0011). The portal's Applications list, a register wizard, and each app's page with connection details, a secret shown once, rotation, setup snippets, a test sign-in, edit and delete.
- `GET/POST /api/apps`, `GET/PATCH/DELETE /api/apps/:id`, `POST /api/apps/:id/secret` and `POST /api/apps/:id/token-check`; operator routes and `pnpm ops apps list|register|rotate`.
- `tenant_apps` with forced row-level security (migration 0003), and `RealmApps` in `packages/keycloak-admin`.
- Realm template v2: the secure-redirect-URI check covers every client.
- `examples/customer-app`, an Express app with `openid-client` that shares single sign-on with Tenantry; `pnpm seed` registers it as "Initech HR".
- `docs/guides/connect-your-app.md`.
- Guarantee tests: bad redirect URIs refused, apps of another workspace out of reach, another workspace's user refused by a customer app, a customer app's token refused by our API, and single sign-on and sign-out with the example app.

### Changed (Phase 4)

- Enterprise workspaces accept tokens only from `tenantry-web` and `tenantry-portal`.
- `GET /api/me` includes the workspace's tier.

### Added (Phase 3)

### Added

- Enterprise tenants in a realm of their own (`ent-<slug>`), built from a versioned template (`enterprise-realm.v1.json`) with client policies: PKCE and secure redirect URIs for public clients, and no implicit or password grant for any client (ADR-0010).
- Operator endpoints `POST /api/platform/enterprise-tenants` and `.../upgrade`, and the commands `pnpm ops enterprise provision` and `pnpm ops enterprise upgrade [--tenant] [--dry-run]`. Every step can run again; the first owner gets a set-password email.
- A create-realm-only provisioner account, and a secrets store for each realm's backend credential, kept out of Postgres (ADR-0023).
- The auth guard reads enterprise roles from `resource_access.tenantry-api` and accepts only the tenant's own realm.
- Members, invites and roles for enterprise tenants, against their realm.
- The seeded enterprise workspace `initech`.
- Guarantee tests for tokens from another realm, the shared realm, the wrong audience, an enterprise token on a Standard workspace, the password grant, and a company login with an email outside the organization's domain.

### Changed (Phase 3)

- Email and display name refresh on every sign-in, and a `users` row is made only for a member.
- The header's product name navigates within the app.

## [0.1.0] - 2026-11-03

The first public milestone: Standard tenants end to end.

### Added

- Signup that creates a workspace, its Keycloak organization and its owner (Phase 1).
- One auth guard for every request; Postgres row-level security as the second isolation layer.
- Members with invites and roles (owner, admin, member), and an audit log of every identity change.
- The portal app at `<slug>.portal.<base domain>`, with its own Keycloak client. One sign-in opens both apps.
- Single logout through the Keycloak session: the other app signs out when its tab or window comes back (ADR-0020).
- App and workspace switchers in the header of both apps.
- Leaving a workspace (`DELETE /api/members/me`); the last owner cannot leave.
- Tenant branding: a logo (PNG, JPEG or WebP up to 256 KB, checked by its bytes) and one colour. A colour below 4.5:1 contrast with white is refused, with a darker shade suggested. The colour drives Carbon's interactive tokens in both apps.
- A Keycloakify login theme in Carbon that shows the workspace's logo and colour (ADR-0021).
- Company login: operators claim a domain, prove it with a DNS TXT record, and link an OIDC identity provider. Linking refuses an unverified domain (ADR-0022).
- `pnpm ops` for operator tasks, and `pnpm seed` for the demo workspaces and accounts.
- A local stand-in company identity provider (Keycloak realm `corp-demo`) and DNS server (CoreDNS) for development.
- Guarantee tests for single logout, the domain-link refusal, and the portal host.

### Changed

- A Keycloak outage now answers 502 everywhere.
- The audit log names its targets (an email or a name).
- Page breadcrumbs navigate within the app instead of reloading it.

[Unreleased]: https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/compare/v0.1.0...v0.6.0
[0.1.0]: https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/releases/tag/v0.1.0

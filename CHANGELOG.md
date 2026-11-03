# Changelog

All notable changes to Tenantry. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/releases/tag/v0.1.0

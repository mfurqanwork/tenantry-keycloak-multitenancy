# Architecture decision records

One short record per decision: context, choice, alternatives, consequences.

| #                                           | Decision                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| [0001](0001-hybrid-tenant-model.md)         | Hybrid tenant model                                          |
| [0002](0002-keycloak-version.md)            | Keycloak 26.8.x, version pinned                              |
| [0003](0003-standard-tier-roles.md)         | Standard-tier roles from organization groups                 |
| [0004](0004-enterprise-tier-roles.md)       | Enterprise-tier roles as client roles                        |
| [0005](0005-tenant-per-request.md)          | Subdomain picks the tenant; the token must prove it          |
| [0006](0006-data-isolation.md)              | Shared tables with forced row-level security                 |
| [0007](0007-user-identity.md)               | Own users table plus identities keyed by issuer and subject  |
| [0008](0008-permissions.md)                 | Permissions from a role-to-permission map                    |
| [0009](0009-identity-writer.md)             | Our API is the only writer of identity data                  |
| [0010](0010-realm-templates.md)             | Versioned realm templates applied by our own code            |
| [0011](0011-customer-apps.md)               | Customer apps: Enterprise tier only                          |
| [0012](0012-scim.md)                        | Keycloak native SCIM per enterprise realm                    |
| [0013](0013-monorepo.md)                    | pnpm + Turborepo TypeScript monorepo                         |
| [0014](0014-nestjs-api.md)                  | NestJS for the API                                           |
| [0015](0015-react-vite-carbon.md)           | React + Vite SPAs with IBM Carbon                            |
| [0016](0016-drizzle-rls.md)                 | Drizzle ORM with SQL RLS policies and a tenantTx helper      |
| [0017](0017-feature-modules.md)             | Feature modules behind two interfaces                        |
| [0018](0018-signup-saga.md)                 | Signup through Keycloak first, with a compensating saga      |
| [0019](0019-keycloak-org-invites.md)        | Invites through Keycloak organization invites                |
| [0020](0020-single-logout-session-check.md) | Single logout through the Keycloak session, checked on focus |
| [0021](0021-keycloakify-login-theme.md)     | Keycloakify login theme JAR in the Keycloak image            |
| [0022](0022-company-idp-by-operator.md)     | Company login linked by an operator, after a DNS proof       |
| [0023](0023-realm-secrets.md)               | Per-realm credentials in a secrets store, not the database   |
| [0024](0024-scim-gateway.md)                | SCIM through a Tenantry gateway in front of native SCIM      |

# ADR-0021: The login theme is a Keycloakify JAR in the Keycloak image

Status: Accepted · Date: 2026-11-03

## Context

The Keycloak login page is the first screen a tenant's people see. It should look like Tenantry (Carbon) and carry the tenant's logo and colour. Keycloak themes are FreeMarker templates packed in a JAR. With organizations enabled, the flow starts on the identity-first page (`login-username.ftl`), then the password page, plus registration, email verification and the rest.

## Decision

- `apps/login-theme` is a Keycloakify 11 theme named `tenantry`, written in React with Carbon styles.
- It keeps Keycloak's own page bodies (Keycloakify's `DefaultPage`), so every page of the flow keeps its behaviour. Our `Template` draws the frame around them, and Carbon's classes style their fields and buttons.
- `pnpm --filter @tenantry/login-theme build:jar` builds `dist_keycloak/tenantry-login-theme.jar`. It needs Maven and a JDK (17 or later) on the machine.
- `infra/keycloak/Dockerfile` builds the same JAR in a Maven stage and copies it into `quay.io/keycloak/keycloak:26.8.1` at `/opt/keycloak/providers/`. So `docker compose` needs no Maven on the host.
- The platform realm sets `loginTheme: tenantry`.

## Alternatives considered

- A plain FreeMarker theme with Carbon CSS: no Node or Maven in the build, but a second templating language and no shared TypeScript with the apps (branding maths, `applyBrand`).
- Writing every page in Carbon React: full control, but each Keycloak page rewritten and kept in step with Keycloak's own.

## Consequences

- The Keycloak image is built, not pulled. The first build downloads Maven and a JDK and takes a few minutes; later builds use Docker's cache.
- Keycloak upgrades need a check that Keycloakify supports the new version.
- If the Keycloakify build breaks, the fallback (a plain theme) is a decision for a person, not a quiet switch.

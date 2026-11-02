# ADR-0002: Keycloak 26.8.x, version pinned

Status: Accepted · Date: 2026-11-02

## Context

Organization groups arrived in 26.6, roles on organization groups in 26.7, and per-domain IdP routing plus supported SCIM in 26.8. Organization permission CVEs were fixed in 26.7.3. Organization behaviour still changes between minor releases.

## Decision

Run Keycloak 26.8.x, with the exact patch version pinned in `infra/docker-compose.yml` and the production compose file. Upgrades are deliberate PRs that must pass the isolation suite.

## Alternatives considered

- Track `latest`: fewer upgrade PRs, but organization changes could silently break isolation.

## Consequences

- Renovate/Dependabot PRs for Keycloak are reviewed by hand.
- The README states the supported Keycloak version.

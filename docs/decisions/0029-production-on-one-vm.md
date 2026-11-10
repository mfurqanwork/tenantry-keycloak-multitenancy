# ADR-0029: Production on one VM

Status: Accepted · Date: 2026-11-10

## Context

Tenantry needs a public demo. The stack uses about 1.2 GB of memory, Keycloak needs about 900 MB of it running all the time, and every workspace has its own subdomain. No free container platform offers that; a small VM does.

## Decision

- **One Linux VM runs the whole stack in Docker Compose** (`infra/prod/compose.prod.yml`) from published images. Only Caddy is reachable from the internet.
- **Caddy holds wildcard certificates** through a Cloudflare DNS challenge. The Cloudflare proxy stays off, because its free certificate covers one subdomain level.
- **Production realms are generated** from the dev realms at image build, so there is one source and a test can prove the output has no local addresses or dev secrets.
- **Mailpit stays, as an internal relay to Resend.** Keycloak and the API keep one SMTP setting in every environment, and the provider's key is never in Keycloak's database. The relay refuses `.test` addresses, so seeded accounts never produce real mail.
- **The live site is a demo.** Each release rebuilds it from nothing, and a nightly job restores a cold copy taken just after seeding. That copy is the only backup.
- **The deploy key can only run the deploy entry point**, which accepts a version number.

## Alternatives considered

- **Each app on its own free host:** none has room for Keycloak, cold starts stall sign-in, and per-workspace subdomains need a wildcard on every provider.
- **Running without Docker:** the same memory, with more to install and upgrade by hand, and no image to roll back to.
- **SMTP credentials in each realm, through Keycloak's vault:** a new realm template and configuration in three places, for what one relay does.

## Consequences

- A release restarts the demo and erases what visitors made. Real customer data would need real upgrades and off-VM backups first.
- The web images are built for one domain.
- Moving to another VM provider changes the guide, not the code.

# Tenantry Phase 6b: live on Azure

## Goal

A public demo at `https://tenantry.pengopal.com`, released by pushing a version tag. Metrics, rate limits, the load test, the security review and the docs site move to 6c.

## Decisions

| Topic     | Decision                                                                            |
| --------- | ----------------------------------------------------------------------------------- |
| Host      | One Azure for Students VM (B1ms, 2 GB, 2 GB swap; resize to B2als v2 if it is slow) |
| DNS       | `pengopal.com` on Cloudflare, proxy off for Tenantry's records                      |
| Addresses | `tenantry.pengopal.com`, and `auth.`, `<slug>.`, `<slug>.portal.` under it          |
| Email     | Resend SMTP, from `no-reply@tenantry.pengopal.com`                                  |
| Versions  | One product version in the root `package.json`, a hand-written changelog CI checks  |
| Deploy    | On a pushed `v*` tag, or by hand with an existing tag                               |
| Demo      | Seeded workspaces with public sign-ins; everything resets every night               |

## 1. The server

`infra/prod/compose.prod.yml` runs published images. Only Caddy publishes ports (80, 443). Every service restarts by itself and has a memory limit and capped logs. Secrets live in `/opt/tenantry/.env` on the VM.

Caddy is built with the Cloudflare DNS module and holds certificates for the base domain, `auth.`, `*.<base>` and `*.portal.<base>`. Its data volume survives deploys, so a release does not ask Let's Encrypt for new certificates.

The API, migrate, ops, web, portal and Caddy images run as a normal user.

## 2. Production settings

**Keycloak** runs `start --optimized`, with its Java memory capped.

**Realms** are generated from the dev files by `scripts/lib/prod-realm.mjs` during the Keycloak image build: `https://` addresses, secrets as `${ENV}` placeholders that Keycloak fills at import, and the sender on the real domain. The password-grant client stays in the realm, **disabled**. The seed turns it on for its own run, then off again. A test fails if the output carries `localhost` or a `dev-` secret, or if that client is enabled.

**Email** goes through Mailpit as an internal relay. Keycloak and the API keep the same unauthenticated `mailpit:1025` they use in development, and Mailpit relays to Resend. This replaces the realm-template v5 and vault approach first proposed: no realm template or API configuration changes, and the Resend key exists only in the relay's configuration, never in Keycloak's database. The relay refuses `.test` recipients, so the seed's demo addresses never reach Resend. Mailpit has no public address.

**Web images** take the base domain and version as build arguments. The images are built for this one domain.

## 3. Releases and deploys

- `pnpm release <version>` checks the tree, branch, version order and changelog, cuts the changelog section, sets the version, commits and tags. It does not push.
- CI fails a pull request that changes `apps/`, `packages/` or `infra/` without adding a line under Unreleased, unless it has the `skip-changelog` label.
- `release.yml` on a `v*` tag: verify the tag; run the same checks as `ci.yml`; publish seven images to `ghcr.io`; create the GitHub Release from the changelog; deploy over SSH; run the live smoke test. A manual run takes an existing tag and only deploys.
- The SSH key may only run the deploy entry point, which accepts a version and nothing else.
- `/api/health` and the account panel show the running version.

## 4. The demo and its reset

Each deploy starts clean: pull the images (a failed pull changes nothing), remove the database and secrets volumes, start, migrate, seed, then take a baseline. Starting clean means realm changes always land.

The **baseline** is a cold copy of the Postgres and secrets volumes. The **nightly reset** (03:00 UTC, cron) stops the stack and restores it, with about a minute of downtime. It is also the backup: nothing else on the VM is worth keeping, and everything can be rebuilt from a release.

The welcome page lists the demo sign-ins and the password, says the demo resets every night, and is shown only when `VITE_DEMO_PASSWORD` is set at build time. In production the seed answers its own domain check in memory, so CoreDNS does not run, and it skips the example customer app, whose redirect is a local address.

Known exposure until 6c's rate limits: a demo owner can send invites to real addresses, capped by Resend's 100 emails a day, and can change a demo password until the next reset.

## Testing

Unit tests cover the changelog and release logic, the production realm, the deploy entry point's input check, the seed's production mode and the welcome page. The production images and the deploy flow are run locally with a stand-in certificate before release.

## Not in this phase

Metrics, rate limits, the load test, the security review, the docs site (6c). An off-VM copy of the baseline.

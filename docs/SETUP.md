# Setting up Tenantry locally

Everything a developer needs to run, seed, test and change Tenantry on their own machine. For what Tenantry is, see the [README](../README.md); for the rules every change follows, [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## What you need

- Docker Desktop (or Docker Engine with Compose v2)
- Node 22 or newer
- pnpm 10 (`corepack enable` gives you the version the repository pins)

`*.localhost` names resolve to your own machine in Chrome, Edge and Firefox, so there are no hosts-file edits.

## Quick start

```bash
pnpm install
```

```bash
pnpm dev:stack
```

```bash
pnpm seed
```

`pnpm dev:stack` builds and starts everything in Docker, then prints the welcome page's address: <http://tenantry.localhost>. The first run creates `.env` from `.env.example`.

`pnpm seed` adds the demo workspaces and people. Running it again changes nothing.

## Addresses

| What                         | Where                                     |
| ---------------------------- | ----------------------------------------- |
| Welcome page and signup      | <http://tenantry.localhost>               |
| A workspace (Tenantry)       | `http://<slug>.tenantry.localhost`        |
| A workspace's Admin          | `http://<slug>.portal.tenantry.localhost` |
| Keycloak (admin console too) | <http://auth.tenantry.localhost>          |
| Mailpit (outgoing email)     | <http://mail.tenantry.localhost>          |

Every port listens on `127.0.0.1` only.

### When a port is taken

`pnpm dev:stack` stops and names the variable to change:

- **Port 80:** set `TENANTRY_HTTP_PORT` (for example `8080`) and add the port to `TENANTRY_AUTH_URL`. Every address above then needs `:8080`.
- **Port 5432:** set `TENANTRY_PG_PORT`, and the same port in `DATABASE_URL` and `DATABASE_OWNER_URL`.
- **Port 8180:** set `TENANTRY_KC_PORT` and `TENANTRY_AUTH_INTERNAL_URL`.

Then run `pnpm dev:stack` again.

## Demo accounts

`pnpm seed` creates these local test accounts. They all use the password in `SEED_PASSWORD` in your `.env`. Keycloak's own admin account is `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` there.

| Account              | Where                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| `ada@example.test`   | Owner of `acme` (blue)                                                      |
| `ben@example.test`   | Admin of `acme`                                                             |
| `cy@example.test`    | Member of `acme`                                                            |
| `gil@example.test`   | Owner of `globex` (green)                                                   |
| `pat@example.test`   | Member of `acme` and `globex`                                               |
| `alice@acme.test`    | Signs in to `acme` through "Acme Corp" (company login)                      |
| `owner@initech.test` | Owner of the Enterprise workspace `initech`, in its own realm `ent-initech` |

The welcome page links the demo workspaces listed in `VITE_DEMO_WORKSPACES`.

## Two ways to run

| Command          | Runs                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:stack` | Everything in Docker, built like production.                                                                  |
| `pnpm dev`       | Keycloak, Postgres, Caddy and Mailpit in Docker; the API, Tenantry and Admin on your machine with hot reload. |

## Commands

| Command                                                     | Does                                                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:stack`                                            | The whole stack in Docker                                                                                         |
| `pnpm dev`                                                  | Infrastructure in Docker; the API and both apps on the host with hot reload                                       |
| `pnpm seed`                                                 | The demo workspaces and accounts                                                                                  |
| `pnpm smoke`                                                | Checks the running stack                                                                                          |
| `pnpm test:isolation`                                       | The README's guarantees and the integration tests, against the running stack                                      |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | What CI runs                                                                                                      |
| `pnpm ops <command>`                                        | Operator commands: enterprise workspaces and their apps, moving a workspace to Enterprise, company login, origins |
| `pnpm brand:icons`                                          | Renders Tenantry's PNG icons after an SVG change ([brand](brand.md))                                              |
| `pnpm stack:down`                                           | Stops the stack                                                                                                   |

## Tests

- **Unit and component tests** sit next to the code (`*.test.ts(x)`) and run with Vitest: `pnpm test`.
- **Isolation and integration tests** need the stack running: `pnpm dev:stack`, then `pnpm test:isolation`. They check every guarantee in the README against real Keycloak and Postgres.
- CI runs both, plus a fresh stack, the smoke check, and the seed twice.

## Starting over

```bash
pnpm stack:down
```

```bash
docker compose -f infra/docker-compose.yml --env-file .env down -v
```

The second command also deletes the databases, so the next `pnpm dev:stack` and `pnpm seed` start from nothing. Realm secrets in `.secrets/` stay; delete that folder too for a full reset.

## Common problems

- **"Docker is not reachable."** Start Docker Desktop, then run the command again.
- **"Port 80 is in use."** See [When a port is taken](#when-a-port-is-taken).
- **A Linux "permission denied" under `.secrets/`.** The folder was made by Docker as root before Phase 5b. Remove it (`sudo rm -rf .secrets`) and run `pnpm dev:stack`, which now makes it as you.
- **The login page shows no workspace colour.** Run `pnpm seed`, or set a colour in Admin › Branding.
- **"Workspace not found."** The address names no workspace: type another, or create one from the welcome page.

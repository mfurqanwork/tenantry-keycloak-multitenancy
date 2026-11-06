<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/ui/assets/brand/tenantry-logo-dark.svg">
  <img src="packages/ui/assets/brand/tenantry-logo.svg" alt="Tenantry" width="336">
</picture>

**Multi-tenant sign-in, teams and branding for SaaS, built on Keycloak.**

[![CI](https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/actions/workflows/ci.yml/badge.svg)](https://github.com/mfurqanwork/tenantry-keycloak-multitenancy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f62fe)](LICENSE)
[![Keycloak 26.8](https://img.shields.io/badge/Keycloak-26.8-4d4d4d?logo=keycloak&logoColor=white)](https://www.keycloak.org/)
[![Node 22](https://img.shields.io/badge/Node-22-5fa04e?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<sub><b>Built with</b></sub><br>

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-5fa04e?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-e0234e?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![IBM Carbon](https://img.shields.io/badge/IBM_Carbon-0f62fe?logo=ibm&logoColor=white)](https://carbondesignsystem.com/)
[![Keycloak](https://img.shields.io/badge/Keycloak-4d4d4d?logo=keycloak&logoColor=white)](https://www.keycloak.org/)
[![Keycloakify](https://img.shields.io/badge/Keycloakify-1a1a1a)](https://www.keycloakify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169e1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-1a1a1a?logo=drizzle&logoColor=c5f74f)](https://orm.drizzle.team/)
[![Docker](https://img.shields.io/badge/Docker-2496ed?logo=docker&logoColor=white)](https://www.docker.com/)
[![Caddy](https://img.shields.io/badge/Caddy-1f88c0?logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Turborepo](https://img.shields.io/badge/Turborepo-ef4444?logo=turborepo&logoColor=white)](https://turborepo.com/)
[![pnpm](https://img.shields.io/badge/pnpm-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

![The Tenantry welcome page](docs/images/welcome.png)

## The problem

Every B2B SaaS product ends up building the same things for each customer: their own sign-in page, teams with roles, a brand, login through the customer's own company identity provider, and directory sync from their IT. Then the biggest customers ask for more: their own security rules, their own apps on the same login, an isolated realm.

Doing that by hand on Keycloak means one realm per customer from day one (expensive, and it doesn't scale to thousands) or one shared realm forever (and no way to give a big customer their own). Either way, one missing filter can leak one customer's data to another.

**Tenantry** is a working, tested answer: two tiers on one codebase, with isolation enforced at the token, the API and the database.

- **Standard** workspaces are organizations in one shared realm: cheap, instant, single sign-on across every workspace a person belongs to.
- **Enterprise** workspaces get a realm of their own, built and upgraded from a versioned template, with their own security rules, apps and directory sync. A Standard workspace can move to Enterprise without anyone losing their account.

```mermaid
flowchart TB
  people([People in many workspaces]) --> guard

  subgraph kc[Keycloak]
    direction LR
    subgraph platform["platform realm: Standard"]
      direction TB
      acme["acme<br/>organization"]
      globex["globex<br/>organization"]
      more["…thousands more"]
    end
    subgraph enterprise["Enterprise: a realm each"]
      direction TB
      initech["ent-initech<br/>realm"]
      umbrella["ent-umbrella<br/>realm"]
    end
  end

  kc -- tokens --> guard
  guard["One guard<br/>subdomain picks the workspace,<br/>the token must prove it"] --> api[One API]
  api --> pg[("Postgres<br/>row-level security per workspace")]
```

The application code never needs to know which tier a workspace is on.

## Features

### Workspaces and teams

Sign up and create a workspace in one screen. Invite people by email, give them a role (owner, admin, member), and see every change in the audit log. Home greets you with a setup card that walks a new owner through the first minute, the workspace's numbers, and the latest projects.

![Home with its setup card](docs/images/home.png)

### Search and notifications

Search pages, people and projects from the header, or press Ctrl+K. The bell tells you what changed: who joined, your role, security settings, a directory token about to expire, and invites from other workspaces. Each person sees only what their role allows.

![Search across the workspace](docs/images/search.png)

![Notifications](docs/images/notifications.png)

### One sign-in, two apps

**Tenantry** is the product people use; **Admin** is where owners and admins manage the workspace. They share one menu and one sign-in, live on separate addresses, and signing out of one signs you out of both.

![Admin › People](docs/images/admin-people.png)

### Branding

Each workspace sets a colour and a logo. Tenantry refuses a colour that white text can't be read on, and suggests a darker shade. The apps and the workspace's own login page take the brand.

![A branded login page](docs/images/login-branded.png)

### Company login

Link a customer's Entra ID, Okta or Google Workspace to their workspace once they prove they own their email domain with a DNS record. People with that domain are sent to their company's sign-in.

### Enterprise

- A realm per customer, built from a versioned template and upgraded with a dry run first.
- **Customer apps:** customers register their own web, single-page, mobile and machine-to-machine apps on their realm, with secrets shown once, rotation and a test sign-in.
- **Directory sync (SCIM)** from Entra ID or Okta, through a Tenantry gateway.
- **Sign-in & security:** two-step sign-in, password, session and lockout rules per workspace.
- **Keycloak console access** for the customer's own admins, limited to people and groups, with owners protected.
- **Move to Enterprise:** an operator command moves a Standard workspace into its own realm, and everyone keeps their account, role and data.

## How it keeps tenants apart

Every promise is an automated test that runs in CI against real Keycloak and Postgres. A few of them:

| What someone tries                                         | What happens                                      |
| ---------------------------------------------------------- | ------------------------------------------------- |
| A user of workspace A asks for workspace B's data          | 404: the row is invisible to them                 |
| A query forgets the workspace filter                       | Postgres row-level security returns only A's rows |
| A client sends a different workspace id than its token's   | Ignored: the token decides                        |
| A token from another Enterprise realm                      | 401                                               |
| A token issued to a customer's app, used on Tenantry's API | 401                                               |
| A console user tries to change an owner                    | 403                                               |

All 33 guarantees are in [tests/isolation](tests/isolation/README.md).

## Architecture

```mermaid
flowchart LR
  browser[Browser] --> caddy[Caddy]
  caddy -->|"&lt;slug&gt;.tenantry"| web[Tenantry<br/>React + Carbon]
  caddy -->|"&lt;slug&gt;.portal.tenantry"| admin[Admin<br/>React + Carbon]
  caddy -->|/api, /scim| api[API<br/>NestJS]
  caddy -->|auth.tenantry| kc[Keycloak 26.8]
  api --> pg[(Postgres<br/>row-level security)]
  api --> kc
  subgraph realms[Keycloak]
    direction TB
    platform["platform realm<br/>Standard: one organization per workspace"]
    ent["ent-&lt;slug&gt; realms<br/>Enterprise: one realm per workspace"]
  end
  kc --- realms
```

The subdomain picks the workspace and the token must prove it. One guard turns every token, from either tier, into the same tenant context. Postgres row-level security is the second layer, so one missing filter cannot leak data. The [decision records](docs/decisions/README.md) explain each choice.

## Try it in five minutes

You need Docker Desktop, Node 22 and pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev:stack
```

```bash
pnpm seed
```

Then open <http://tenantry.localhost> and pick a demo workspace. The accounts, the ports and what to do when one is taken are in [docs/SETUP.md](docs/SETUP.md), and a two-minute walkthrough is in the [demo script](docs/demo-script.md).

## Documentation

- [Setting up locally](docs/SETUP.md): addresses, demo accounts, commands, tests, common problems
- Guides: [connect your app](docs/guides/connect-your-app.md), [connect SCIM](docs/guides/connect-scim.md), [move a workspace to Enterprise](docs/guides/move-to-enterprise.md)
- [Decision records](docs/decisions/README.md)
- [Demo script](docs/demo-script.md)
- [Known issues](docs/known-issues.md)
- [Brand](docs/brand.md)
- [Contributing](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) (the rules every change follows)

## Roadmap

| Phase | Delivers                                                                         | Status |
| ----- | -------------------------------------------------------------------------------- | ------ |
| 0–2   | Foundations, the Standard workspace core, single sign-on and branding → **v0.1** | Done   |
| 3–4   | Enterprise realms from versioned templates; customer apps                        | Done   |
| 5     | SCIM, security settings, console access, moving to Enterprise                    | Done   |
| 6a    | A simpler Tenantry: Tenantry and Admin, the welcome page, the brand              | Done   |
| 6b    | Running in production: TLS, backups, health, metrics, rate limits                | Next   |
| 6c    | Load test at 50, 100 and 200 realms, security review, docs site → **v1.0**       | Later  |

## Licence

[MIT](LICENSE)

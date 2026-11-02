# Tenantry Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh clone of Tenantry starts every service with one command. Each service answers on its local hostname, the decisions are documented, and CI is green.

**Architecture:**

- **Workspace:** a pnpm + Turborepo TypeScript workspace.
- **Local stack:** Docker Compose runs Caddy (wildcard `*.localhost` routing), Keycloak 26.8 (`platform` realm imported), Postgres 17 (separate app and Keycloak databases), Mailpit, the NestJS API and the two React SPAs.
- **API:** exposes only `/api/health` in this phase.
- **UI:** the SPAs render a Carbon `AppShell` and five page-pattern templates from `packages/ui`.

**Tech Stack:** Node 22, pnpm 10, Turborepo 2, TypeScript 5 (strict), NestJS 11, Vite + React 19, `@carbon/react` (Carbon v11), Drizzle ORM + drizzle-kit, Vitest, ESLint (typescript-eslint strict), Prettier, stylelint, Caddy 2, Keycloak 26.8.x, Postgres 17, Mailpit, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-02-tenantry-phase0-design.md` (decisions: `docs/decisions/`)

## Global Constraints

- **Product and packages:** the product name is `Tenantry`. Workspace packages are scoped `@tenantry/*`: `@tenantry/api`, `@tenantry/web`, `@tenantry/portal`, `@tenantry/ui`, `@tenantry/db`, `@tenantry/auth`, `@tenantry/keycloak-admin`, `@tenantry/oidc-client`.
- **Folder name:** never hard-code the repo folder name (it will be renamed to `tenantry-keycloak-multitenancy`).
- **Node:** Node `>=22`, set in root `engines`. The pnpm version goes in the `packageManager` field.
- **Keycloak:** the image is pinned to an exact patch, `quay.io/keycloak/keycloak:26.8.1`. If that tag does not exist when you build, use the newest `26.8.x` and update ADR-0002.
- **Hostnames:**
  - `auth.tenantry.localhost` for Keycloak; `mail.tenantry.localhost` for Mailpit.
  - `<slug>.tenantry.localhost` for web; `<slug>.portal.tenantry.localhost` for portal.
  - `/api/*` on either tenant host goes to the API.
- **Issuer:** `${TENANTRY_AUTH_URL}/realms/platform`, where the default `TENANTRY_AUTH_URL` is `http://auth.tenantry.localhost`. Browser and containers must see the same value.
- **Database roles:** the API connects only as `tenantry_app`, which owns no tables and has no `BYPASSRLS`. Migrations run as `tenantry_owner`.
- **Access tokens:** they live 5 minutes (`accessTokenLifespan: 300`).
- **UI building blocks:** use only Carbon components, `@carbon/icons-react` and Carbon tokens; never a second component library.
- **UI look:**
  - Themes are `g10` and `g100`, following the OS, with a user override. The header is always `g100`.
  - Fonts are IBM Plex Sans and Mono, on the productive type scale.
  - Corners are square, with no gradients and no custom shadows.
- **Secrets:** `.env` is gitignored; `.env.example` is committed.
- **Licence:** MIT, copyright holder "Tenantry contributors".

## Review Focus

1. **Windows line endings.** On a Windows clone, `git` must not convert `.sh`, `Caddyfile` or realm JSON to CRLF, or the containers misread them. Fix: a `.gitattributes` with `* text=auto eol=lf` (Task 1), with a test that checks it.
2. **Port 80 already taken on the host** (IIS, another proxy). `pnpm dev:stack` must stop with a clear message that names `TENANTRY_HTTP_PORT`, not a raw Docker error (Task 3).
3. **Keycloak is slow on first start (often 30–90 s).** The API must not crash-loop. `/api/health` returns 503 and names the failing check `keycloak` until Keycloak is up (Task 4).
4. **Issuer seen from inside Docker differs from the one the browser sees.** That would break every Phase 1 token check. The smoke script compares the issuer fetched from the host with the issuer fetched from inside the `api` container (Task 3 checks it on the host, Task 6 from inside).
5. **Private browsing or blocked storage.** Reading the saved theme preference must not throw: the UI falls back to the OS theme (Task 5).

---

## File structure

```
.gitattributes .gitignore .editorconfig .npmrc .nvmrc .env.example
package.json pnpm-workspace.yaml turbo.json tsconfig.base.json
eslint.config.mjs prettier.config.mjs stylelint.config.mjs vitest.workspace.ts
packages/auth/            src/{roles.ts,context.ts,index.ts} + roles.test.ts
packages/db/              drizzle.config.ts, src/{client.ts,migrate.ts,index.ts}, migrations/0000_baseline.sql
packages/keycloak-admin/  README.md, package.json, src/index.ts (empty export)
packages/oidc-client/     README.md, package.json, src/index.ts (empty export)
packages/ui/              src/theme/{ThemeProvider.tsx,preference.ts}, src/shell/AppShell.tsx,
                          src/patterns/{PageHeader,ListPage,DetailPage,SettingsPage,DashboardPage,WizardPage}.tsx,
                          src/styles/index.scss, src/index.ts, tests alongside (*.test.tsx)
apps/api/                 src/{main.ts,app.module.ts}, src/config/{config.ts,config.test.ts},
                          src/health/{health.controller.ts,keycloak.health.ts,db.health.ts,*.test.ts}, Dockerfile
apps/web/, apps/portal/   index.html, vite.config.ts, src/{main.tsx,App.tsx,routes/*.tsx}, Dockerfile, Caddyfile.spa
infra/                    docker-compose.yml, Caddyfile, postgres/init.sh, keycloak/platform-realm.json
scripts/                  dev-stack.mjs, smoke.mjs, lib/{http.mjs,port.mjs} + port.test.mjs
docs/                     decisions/ (exists), guides/.gitkeep
README.md AGENTS.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md LICENSE
.github/                  workflows/ci.yml, ISSUE_TEMPLATE/{bug.yml,feature.yml}, pull_request_template.md
```

**One deviation from the spec, flagged for review.** The spec runs web and portal as Vite dev servers in containers. On Windows, bind-mounted `node_modules` and file watching in Docker are slow and unreliable, so this plan does two things instead:

- **Full stack** (`pnpm dev:stack`): web and portal are built images that serve static files. This meets exit criterion 1.
- **Development** (`pnpm dev`): Caddy, Keycloak, Postgres and Mailpit run in Compose; the API, web and portal run on the host with hot reload. Caddy reaches them through `host.docker.internal`, selected by `*_UPSTREAM` env vars.

Task 3 updates the spec's stack table to match.

---

### Task 1: Workspace tooling and `@tenantry/auth`

**Files:**

- Create the root files listed above (except `.env.example`, `vitest.workspace.ts` entries for later packages are globbed).
- Create `packages/auth/*`.

**Interfaces:**

- Produces, from `@tenantry/auth`:
  ```ts
  export type Role = 'owner' | 'admin' | 'member';
  export type Permission =
    | 'members:read'
    | 'members:invite'
    | 'members:remove'
    | 'members:change-role'
    | 'apps:read'
    | 'apps:register'
    | 'tenant:settings'
    | 'audit:read';
  export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>>;
  export function permissionsFor(roles: readonly Role[]): ReadonlySet<Permission>;
  export interface TenantContext {
    readonly tenantId: string;
    readonly userId: string;
    readonly roles: readonly Role[];
    readonly permissions: ReadonlySet<Permission>;
  }
  ```
- Produces, as root scripts: `lint`, `typecheck`, `test`, `build` (all `turbo run <x>`), `format`.

- [ ] **Step 1: Root tooling.**
  - `pnpm-workspace.yaml` globs `apps/*` and `packages/*`.
  - `turbo.json` defines tasks `build` (outputs `dist/**`), `lint`, `typecheck`, `test` and `dev` (persistent, no cache).
  - `tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution` `NodeNext` and `target` `ES2023`.
  - `eslint.config.mjs` is flat config with typescript-eslint `strictTypeChecked`, plus `no-restricted-imports` banning `pg` and `drizzle-orm/node-postgres` outside `packages/db` (ADR-0016).
  - `.gitattributes`: `* text=auto eol=lf`, and `*.png binary`.
  - `.nvmrc`: `22`.
- [ ] **Step 2: Write the failing test** at `packages/auth/src/roles.test.ts`:
  ```ts
  expect(permissionsFor(['owner'])).toEqual(new Set(ROLE_PERMISSIONS.owner));
  expect(ROLE_PERMISSIONS.owner).toHaveLength(8); // owner has every permission
  expect(permissionsFor(['admin']).has('tenant:settings')).toBe(false);
  expect([...permissionsFor(['member'])].sort()).toEqual(['apps:read', 'members:read']);
  expect(permissionsFor(['member', 'admin']).has('members:invite')).toBe(true); // union of roles
  expect(permissionsFor([]).size).toBe(0);
  ```
  Also add a test in `scripts/lib/gitattributes.test.mjs` (Review Focus 1): read `.gitattributes` and assert it contains `eol=lf`.
- [ ] **Step 3: Run `pnpm install && pnpm --filter @tenantry/auth test`.** Expected: FAIL, module not found.
- [ ] **Step 4: Implement `roles.ts` and `context.ts`.**
  - Admin gets every permission except `tenant:settings`.
  - Member gets `members:read` and `apps:read`.
- [ ] **Step 5: Run `pnpm lint && pnpm typecheck && pnpm test`.** Expected: all PASS.
- [ ] **Step 6: Commit.** `chore: workspace tooling and @tenantry/auth permission map`

### Task 2: `@tenantry/db` baseline

**Files:**

- Create `packages/db/{package.json,drizzle.config.ts,src/client.ts,src/migrate.ts,src/index.ts,migrations/0000_baseline.sql,src/client.test.ts}`.

**Interfaces:**

- Produces:
  - `createAppPool(databaseUrl: string): pg.Pool`, for use by the API.
  - `pingDatabase(pool: pg.Pool): Promise<void>`, which runs `select 1` and throws on failure.
  - `runMigrations(ownerUrl: string): Promise<void>`, which uses drizzle's node-postgres migrator on `./migrations`.
  - A bin script `tenantry-migrate` that reads `DATABASE_OWNER_URL`.
- Baseline SQL:
  - `GRANT USAGE ON SCHEMA public TO tenantry_app;`
  - `ALTER DEFAULT PRIVILEGES FOR ROLE tenantry_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tenantry_app;`
  - The same for sequences, with `USAGE, SELECT`.

- [ ] **Step 1: Write the failing test.** `pingDatabase` rejects when the pool's `query` rejects, and resolves when it resolves. Mock the pool with `{ query: vi.fn() }`.
- [ ] **Step 2: Run `pnpm --filter @tenantry/db test`.** Expected: FAIL.
- [ ] **Step 3: Implement `client.ts`, `migrate.ts`, the baseline SQL and the drizzle journal.** Generate the journal with `drizzle-kit generate --custom --name baseline`, then paste in the SQL above.
- [ ] **Step 4: Run the tests.** Expected: PASS. The real migration is exercised in Task 3, Step 6.
- [ ] **Step 5: Commit.** `feat(db): drizzle setup and baseline grants for tenantry_app`

### Task 3: Infrastructure stack and smoke script

**Files:**

- Create:
  - `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/postgres/init.sh`
  - `infra/keycloak/platform-realm.json`
  - `.env.example`
  - `scripts/dev-stack.mjs`, `scripts/smoke.mjs`
  - `scripts/lib/http.mjs`, `scripts/lib/port.mjs`, `scripts/lib/port.test.mjs`
- Modify: root `package.json` scripts, and the spec's "Local stack" table (to match the deviation above).

**Interfaces:**

- Produces:
  - `getVia(hostHeader: string, path: string, port?: number): Promise<{ status: number; body: string }>`. It sends a `node:http` request to `127.0.0.1` with a `Host` header, because Windows does not resolve `*.localhost` for Node.
  - `isPortFree(port: number): Promise<boolean>`.
  - Root scripts:
    - `dev:stack`: copy `.env.example` to `.env` if `.env` is missing, check the port, then `docker compose -f infra/docker-compose.yml --env-file .env up -d --build --wait`.
    - `dev:infra`: the same, limited to the services `caddy keycloak postgres mailpit`, with the upstreams set to `host.docker.internal`.
    - `dev`: runs `dev:infra`, then `turbo run dev` (API watch plus the two Vite servers on the host).
    - `smoke`: runs `scripts/smoke.mjs`.
    - `stack:down`: stops the stack.
- `.env.example` keys:
  - `TENANTRY_HTTP_PORT=80`, `TENANTRY_AUTH_URL=http://auth.tenantry.localhost`
  - `POSTGRES_PASSWORD`, `TENANTRY_OWNER_PASSWORD`, `TENANTRY_APP_PASSWORD`, `KEYCLOAK_DB_PASSWORD`
  - `KC_BOOTSTRAP_ADMIN_USERNAME=admin`, `KC_BOOTSTRAP_ADMIN_PASSWORD`, all with dev-only placeholder values
  - `WEB_UPSTREAM=web:80`, `PORTAL_UPSTREAM=portal:80`, `API_UPSTREAM=api:3000`
  - `DATABASE_URL` (as `tenantry_app`), `DATABASE_OWNER_URL` (as `tenantry_owner`)

**Compose details the implementer cannot guess:**

- **Project name:** set top-level `name: tenantry` in the compose file, so volumes and labels don't depend on the folder name.
- **caddy:**
  - Publishes `${TENANTRY_HTTP_PORT}:${TENANTRY_HTTP_PORT}` and listens on that same port inside, so the internal and external issuers match.
  - Has network alias `auth.tenantry.localhost`.
  - Uses `extra_hosts: ["host.docker.internal:host-gateway"]`.
- **Caddyfile:** the site addresses use `http://` (no auto-HTTPS). There are four blocks:
  - `http://auth.tenantry.localhost:{$TENANTRY_HTTP_PORT}` → `keycloak:8080`
  - `http://mail.tenantry.localhost:{$TENANTRY_HTTP_PORT}` → `mailpit:8025`
  - `http://*.portal.tenantry.localhost:{$TENANTRY_HTTP_PORT}`: `handle /api/*` → `{$API_UPSTREAM}`, everything else → `{$PORTAL_UPSTREAM}`
  - `http://*.tenantry.localhost:{$TENANTRY_HTTP_PORT}`: the same, with `{$WEB_UPSTREAM}`

  Caddy's `*` matches one label, so the portal and web blocks do not overlap. Keep `Host` (Caddy's default) and add `X-Forwarded-Host`.

- **keycloak:**
  - `start-dev --import-realm`, with `KC_HOSTNAME=${TENANTRY_AUTH_URL}`, `KC_HTTP_ENABLED=true`, `KC_HEALTH_ENABLED=true`, and `KC_DB=postgres` on database `keycloak`.
  - Mount `infra/keycloak/platform-realm.json` at `/opt/keycloak/data/import/`.
  - The image has no curl, so the healthcheck uses bash `/dev/tcp`: open `localhost:9000`, send `GET /health/ready`, and grep for `"UP"`. Set `start_period: 120s`.
- **postgres:** `postgres:17`. `init.sh` creates:
  - roles `tenantry_owner` (LOGIN) and `tenantry_app` (LOGIN, NOSUPERUSER, NOBYPASSRLS);
  - database `tenantry` owned by `tenantry_owner`;
  - role and database `keycloak`.

  Passwords come from env. The healthcheck is `pg_isready`.

- **mailpit:** `axllent/mailpit`.
- **migrate:** a one-shot service built from the api image. It runs `tenantry-migrate` and depends on postgres being healthy.
- **Realm JSON:**
  - `realm: platform`, `enabled: true`, `organizationsEnabled: true`
  - `accessTokenLifespan: 300`, `ssoSessionIdleTimeout: 1800`
  - `loginTheme` unset; no clients beyond the built-ins
  - SMTP pointed at `mailpit:1025`

- [ ] **Step 1: Write the failing test.** `port.test.mjs` uses `node:test`. Start a `net` server on an ephemeral port and assert `isPortFree(thatPort) === false`. Close the server and assert `true`.
- [ ] **Step 2: Run `node --test scripts/lib`.** Expected: FAIL.
- [ ] **Step 3: Implement `port.mjs`, `http.mjs` and `dev-stack.mjs`.** If the port is busy, print `Port <n> is in use. Set TENANTRY_HTTP_PORT and TENANTRY_AUTH_URL (with the port) in .env, then rerun.` and exit 1 (Review Focus 2).
- [ ] **Step 4: Write `smoke.mjs`.** Each check prints PASS or FAIL, and the script exits non-zero on any failure. This task's checks:
  - The discovery doc at `auth.tenantry.localhost` returns `/realms/platform/.well-known/openid-configuration` with status 200, and `issuer === TENANTRY_AUTH_URL + '/realms/platform'`.
  - Mailpit answers 200.

  Task 6 adds the app checks.

- [ ] **Step 5: Write the compose file, Caddyfile, init script, realm JSON and `.env.example`.** For now, run with `dev:infra` (caddy, keycloak, postgres, mailpit, migrate).
- [ ] **Step 6: Run `pnpm dev:infra && pnpm smoke`.** Expected: both checks PASS, and `docker compose logs migrate` shows the baseline applied. Also confirm the RLS precondition: `docker compose exec postgres psql -U postgres -tc "select rolbypassrls, rolsuper from pg_roles where rolname='tenantry_app'"` must print `f | f`.
- [ ] **Step 7: Run the port tests and update the spec's stack table** for the deviation.
- [ ] **Step 8: Commit.** `feat(infra): compose stack with caddy, keycloak platform realm, postgres roles, smoke script`

### Task 4: `@tenantry/api` with health

**Files:**

- Create `apps/api/{package.json,nest-cli.json,tsconfig.json,vitest.config.ts,Dockerfile}` and the `src/*` files listed in the file structure.

**Interfaces:**

- Consumes: `createAppPool` and `pingDatabase` from `@tenantry/db`.
- Produces:
  ```ts
  export interface AppConfig {
    port: number;
    databaseUrl: string;
    authUrl: string;
    platformRealm: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  }
  export class ConfigError extends Error {}
  export function loadConfig(env: Record<string, string | undefined>): AppConfig;
  ```
  - Env names: `PORT` (default 3000), `DATABASE_URL`, `TENANTRY_AUTH_URL`, `TENANTRY_PLATFORM_REALM` (default `platform`), `LOG_LEVEL` (default `info`).
  - Global prefix `api`. `GET /api/health` uses Terminus with indicators `database` and `keycloak`.
  - `KeycloakHealthIndicator` fetches `${authUrl}/realms/${platformRealm}/.well-known/openid-configuration` (3 s timeout). The check is up only on status 200 with a matching `issuer`.
- Docker: a multi-stage build with `turbo prune @tenantry/api --docker`, then `pnpm install --frozen-lockfile`, then build. The runtime is `node:22-slim`. The image also contains the `tenantry-migrate` bin from `@tenantry/db`.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  // config.test.ts
  expect(() => loadConfig({})).toThrow(ConfigError);
  expect(() => loadConfig({})).toThrow(/DATABASE_URL.*TENANTRY_AUTH_URL|TENANTRY_AUTH_URL.*DATABASE_URL/); // names every missing var
  expect(
    loadConfig({ DATABASE_URL: 'postgres://x', TENANTRY_AUTH_URL: 'http://auth.tenantry.localhost' }),
  ).toEqual({
    port: 3000,
    databaseUrl: 'postgres://x',
    authUrl: 'http://auth.tenantry.localhost',
    platformRealm: 'platform',
    logLevel: 'info',
  });
  // keycloak.health.test.ts (fetch stubbed with vi.stubGlobal)
  // 200 + matching issuer → { keycloak: { status: 'up' } }
  // 200 + issuer 'http://localhost:8080/realms/platform' → throws HealthCheckError, message contains 'issuer mismatch'
  // fetch rejects (Keycloak still starting) → throws HealthCheckError, not an unhandled rejection (Review Focus 3)
  // health.controller.test.ts — Nest testing module with both indicators mocked:
  // all up → 200 body.status === 'ok'; keycloak down → ServiceUnavailableException with body.error.keycloak
  ```
- [ ] **Step 2: Run `pnpm --filter @tenantry/api test`.** Expected: FAIL.
- [ ] **Step 3: Implement the config, indicators, controller, `AppModule` and `main.ts`.**
  - Use `nestjs-pino` for structured logs.
  - `main.ts` calls `loadConfig(process.env)` before `NestFactory.create`, so a bad config fails fast with the `ConfigError` message.
  - Vitest uses `unplugin-swc` for decorators.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Add the `api` service to compose.**
  - It depends on `migrate` (completed) and `keycloak` (healthy).
  - Its healthcheck is `node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"`.
  - It sets `DATABASE_URL` to the `tenantry_app` URL.
- [ ] **Step 6: Commit.** `feat(api): NestJS app with config validation and health checks`

### Task 5: `@tenantry/ui` — theme, AppShell, page patterns

**Files:**

- Create `packages/ui/*` per the file structure, plus `stylelint.config.mjs` at the root.

**Interfaces:**

- Produces:
  ```ts
  export type ThemePreference = 'system' | 'light' | 'dark';
  export const THEME_STORAGE_KEY = 'tenantry.theme';
  export function readPreference(storage?: Storage): ThemePreference; // never throws → 'system'
  export function writePreference(p: ThemePreference, storage?: Storage): void; // never throws
  export function TenantryThemeProvider(props: { children: ReactNode }): JSX.Element; // g10 / g100
  export function useThemePreference(): {
    preference: ThemePreference;
    resolved: 'g10' | 'g100';
    setPreference(p: ThemePreference): void;
  };
  export interface NavItem {
    label: string;
    href: string;
    icon?: CarbonIconType;
  }
  export function AppShell(props: {
    productName: string;
    navItems: NavItem[];
    children: ReactNode;
  }): JSX.Element;
  export interface Crumb {
    label: string;
    href?: string;
  }
  export function PageHeader(props: {
    breadcrumbs?: Crumb[];
    title: string;
    actions?: ReactNode;
  }): JSX.Element;
  export function ListPage(props: {
    breadcrumbs?: Crumb[];
    title: string;
    primaryAction?: ReactNode;
    isEmpty: boolean;
    emptyState: ReactNode;
    children: ReactNode;
  }): JSX.Element;
  export function DetailPage(props: {
    breadcrumbs?: Crumb[];
    title: string;
    actions?: ReactNode;
    summary: ReactNode;
    tabs: { label: string; content: ReactNode }[];
  }): JSX.Element;
  export function SettingsPage(props: {
    breadcrumbs?: Crumb[];
    title: string;
    children: ReactNode;
    dirty: boolean;
    saving: boolean;
    onSave(): void;
    onDiscard(): void;
  }): JSX.Element;
  export function DashboardPage(props: {
    title: string;
    tiles: ReactNode[];
    activity?: ReactNode;
  }): JSX.Element;
  export function WizardPage(props: {
    title: string;
    steps: string[];
    currentStep: number;
    children: ReactNode;
    onBack?(): void;
    onNext(): void;
    nextLabel?: string;
    nextDisabled?: boolean;
  }): JSX.Element;
  export function applyBrand(color: string): void; // Phase 0: exported no-op so call sites compile; Phase 2 sets --cds-interactive* tokens
  ```
- `@tenantry/ui/styles.scss` is imported once by each app.

**UI checklist.** It was read 2026-11-02, with no pages in the project yet.

There is no reference and no family, so each line below is _as asked_ by the approved spec (level 1). Carbon is the source for every piece, because the project has no shared layer yet.

- [ ] **Page holder.** `AppShell` renders Carbon `Header` inside `<Theme theme="g100">`, plus `SideNav` and `Content` as the `main` landmark. The header stays g100 in both themes.
- [ ] **Header.** It shows `HeaderName` with the product name, `HeaderGlobalBar` with a theme switcher (`HeaderGlobalAction` with the icons `Light`, `Asleep` and `Screen`), and a skip-to-content link.
- [ ] **Side nav.** It uses `SideNavLink` per `NavItem`. The current route is marked with `isActive` and `aria-current="page"`. It collapses into the hamburger at Carbon's `lg` breakpoint.
- [ ] **Page header** (all five patterns). It shows the Carbon `Breadcrumb`, then the title as the page's only `h1` on the productive heading token, then the actions aligned to the end.
- [ ] **ListPage body.** `children` holds the DataTable, which arrives in Phase 1. When `isEmpty` is true, `emptyState` renders in its place.
- [ ] **DetailPage body.** It uses Carbon `Tabs`, `TabList` and `TabPanels`, with the `summary` above them in Carbon `Tile`s.
- [ ] **SettingsPage body.** A save bar sits at the bottom of the content area. It has a primary `Button` "Save" (disabled while not dirty or while saving, showing `InlineLoading` while saving) and a secondary "Discard".
- [ ] **DashboardPage body.** Tiles sit in a Carbon `Grid` / `Column` (sm 4, md 4, lg 4), followed by the activity area.
- [ ] **WizardPage body.** It shows a Carbon `ProgressIndicator` with `currentIndex` set to `currentStep`, then the content, then Back (secondary) and Next (primary, label from `nextLabel`, default "Next").
- [ ] **Colour, spacing and type** come only from Carbon tokens (`$spacing-*`, `--cds-*`, `type-style`). stylelint bans `px` and `rem` on margin, padding, gap and size properties in `.scss`. There are no `box-shadow`, `border-radius` or `linear-gradient` declarations.
- [ ] **Not copied:** nothing, since there is no reference. New copy for review: "Save", "Discard", "Back", "Next", and the theme switcher labels "Light theme", "Dark theme" and "Use system theme".

- [ ] **Step 1: Write the failing tests.** They use Vitest with jsdom and Testing Library.
  ```ts
  // preference.test.ts
  expect(
    readPreference({
      getItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage),
  ).toBe('system'); // Review Focus 5
  expect(() =>
    writePreference('dark', {
      setItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage),
  ).not.toThrow();
  expect(readPreference(storageWith('tenantry.theme', 'bogus'))).toBe('system');
  // ThemeProvider.test.tsx — matchMedia stubbed dark → resolved 'g100'; preference 'light' overrides → 'g10'
  // AppShell.test.tsx — in both themes the header's closest '.cds--g100' exists; getByRole('main'); nav link for current path has aria-current="page"
  // patterns.test.tsx — each pattern renders exactly one heading level 1 with its title;
  //   ListPage isEmpty → emptyState shown, children not; SettingsPage dirty=false → Save disabled;
  //   WizardPage currentStep=1 of 3 → second step marked current; clicking Next calls onNext
  ```
- [ ] **Step 2: Run `pnpm --filter @tenantry/ui test`.** Expected: FAIL.
- [ ] **Step 3: Implement it.** In `styles/index.scss`, use `@use '@carbon/react'` with Carbon's IBM Plex font-face enabled, so Plex loads from the package files and not from a CDN. Task 6 verifies this.
- [ ] **Step 4: Run `pnpm --filter @tenantry/ui test && pnpm lint`,** which includes stylelint. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(ui): Carbon theme provider, AppShell and five page patterns`

### Task 6: `@tenantry/web` and `@tenantry/portal`

**Files:**

- Create `apps/web/*` and `apps/portal/*`. They share the same layout; only the product name and nav differ.
- Modify `infra/docker-compose.yml` (adding the `web` and `portal` services) and `scripts/smoke.mjs` (adding the app checks).

**Interfaces:**

- Consumes `TenantryThemeProvider`, `AppShell` and all five patterns from `@tenantry/ui`.
- Web: productName `Tenantry`; nav Dashboard (`/`), Patterns (`/patterns`). Routing uses `react-router` v7 in library mode.
- Portal: productName `Tenantry Portal`; nav Dashboard (`/`).
- `/` renders `DashboardPage` with three placeholder tiles: "Tenant", the slug read from `location.hostname.split('.')[0]`; "Realm", `platform`; "Status", "Phase 0".
- `/patterns` (web only) renders each of the five patterns once with sample content, for visual checks.
- Vite: `server.host: true`, `server.port` 5173 for web and 5174 for portal, `server.allowedHosts: ['.tenantry.localhost']`, and `server.hmr.clientPort` from `TENANTRY_HTTP_PORT`.
- Docker: `turbo prune`, then build, then `caddy:2-alpine` serving `dist` with `try_files {path} /index.html` (from `Caddyfile.spa`).

- [ ] **Step 1: Write the failing tests.**
  - `App.test.tsx` (web): rendering at `/` shows the heading "Dashboard" and a tile with text `demo` when the hostname is stubbed to `demo.tenantry.localhost`. Rendering at `/patterns` shows the pattern sections.
  - The same tests for portal at `/` only.
- [ ] **Step 2: Run `pnpm --filter "./apps/*" test`.** Expected: FAIL.
- [ ] **Step 3: Implement both apps.** Add the `web` and `portal` services to compose, each with a `wget -qO- localhost` healthcheck.
- [ ] **Step 4: Extend `smoke.mjs`.**
  - `getVia('demo.tenantry.localhost', '/')` and `getVia('demo.portal.tenantry.localhost', '/')` return 200 with `<div id="root">`.
  - `getVia('demo.tenantry.localhost', '/api/health')` returns 200 with `status === 'ok'`.
  - **Issuer seen from inside the API container** (Review Focus 4). Run `docker compose exec -T api node -e "<fetch discovery and print issuer>"`, then assert it equals the host-side issuer.
- [ ] **Step 5: Run the stack from clean.** Run `pnpm stack:down && docker volume prune -f --filter label=com.docker.compose.project=tenantry`, then `pnpm dev:stack && pnpm smoke`. Expected: all checks PASS.
- [ ] **Step 6: Visual check in the built-in browser.**
  - Open `http://demo.tenantry.localhost` and `/patterns` in light, dark and system modes, and at phone width (375 px).
  - Open `http://demo.portal.tenantry.localhost`.
  - The header must be dark in every mode, and the network tab must show the Plex font files coming from the app origin.
  - Run `ui-consistency:verifying` against the Task 5 checklist.
- [ ] **Step 7: Commit.** `feat(apps): web and portal shells on Carbon, wired into the stack`

### Task 7: Repo docs, stub packages and CI

**Files:**

- Create:
  - `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`
  - `.github/workflows/ci.yml`, `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml}`, `.github/pull_request_template.md`
  - `packages/keycloak-admin/{README.md,package.json,src/index.ts}`, `packages/oidc-client/{README.md,package.json,src/index.ts}`
  - `docs/guides/.gitkeep`

**Content the implementer cannot infer:**

- **README sections:**
  1. Pitch: one paragraph, based on the plan doc's opening.
  2. "Guarantees": the 16 rows of the plan doc's security test table, each marked _planned_ with its phase.
  3. Quick start: `pnpm install`, then `pnpm dev:stack`, then open `http://demo.tenantry.localhost`. Also cover the port-80 note and Keycloak admin at `http://auth.tenantry.localhost` with credentials from `.env`.
  4. Architecture: a Mermaid diagram of browser → Caddy → {web, portal, api, keycloak}, with api → postgres and keycloak → postgres.
  5. Standard vs Enterprise table: copied from the plan doc.
  6. Links to `docs/decisions/`.
  7. Licence.
- **AGENTS.md hard rules** (verbatim intent from the plan doc, plus these):
  - Never query tenant tables outside `tenantTx`.
  - Never read top-level `realm_access`.
  - Never trust a tenant id from the client.
  - Only `packages/keycloak-admin` calls Keycloak admin endpoints.
  - Every identity change writes an audit entry.
  - Every new tenant table or endpoint gets an isolation test.
  - New screens start from a `@tenantry/ui` page pattern and use Carbon components and tokens only.
  - Commands: `pnpm dev`, `pnpm dev:stack`, `pnpm smoke`, `pnpm lint|typecheck|test|build`.
- **CONTRIBUTING:** Conventional Commits; a PR checklist (tests, isolation test if tenant data is touched, ADR if a decision changes).
- **SECURITY:** report privately through GitHub Security Advisories; the supported version is `main` until v1.0. The threat model in five bullets: cross-tenant data access, token confusion between realms, privilege escalation across orgs, over-powered provisioning credential, secret leakage.
- **CODE_OF_CONDUCT:** Contributor Covenant 2.1, with the contact being GitHub Security Advisories / the maintainer's GitHub profile (no email address).
- **ci.yml:**
  - Runs on push and on pull_request to `main`.
  - `ubuntu-latest`; `pnpm/action-setup` (version from `packageManager`); `actions/setup-node` with Node 22 and pnpm cache.
  - Steps: `pnpm install --frozen-lockfile`, then `pnpm turbo run lint typecheck test build`, then `node --test scripts/lib`.

- [ ] **Step 1: Write the stub packages.** Each README states the package's single responsibility and the phase that fills it.
- [ ] **Step 2: Write the docs and the GitHub templates.**
- [ ] **Step 3: Run what CI runs, locally.** Run `pnpm install --frozen-lockfile && pnpm turbo run lint typecheck test build && node --test scripts/lib`. Expected: all PASS.
- [ ] **Step 4: Commit.** `docs: README, AGENTS.md, contributor docs and CI workflow`

---

## Phase 0 exit check (after Task 7)

- [ ] From a fresh clone in a new folder: `pnpm install && pnpm dev:stack && pnpm smoke`. All checks PASS, which covers spec exit criteria 1–3.
- [ ] `pnpm turbo run lint typecheck test build` passes. CI goes green once you push to GitHub (criterion 4, verified after you create the repo).
- [ ] 16 ADRs plus the repo docs exist (criterion 5).

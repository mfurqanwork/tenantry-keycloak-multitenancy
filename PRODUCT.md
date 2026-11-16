# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Company admins and owners** setting up their team's workspace: invite people, give roles, add their colour and logo, turn on company login, directory sync and security rules. They work in a browser at a desk, a few times a week, often during set-up.
- **Members** of a workspace who sign in, land on Home and work in Projects. Many belong to several workspaces and switch between them.
- **Evaluators**: engineers and hiring managers judging Tenantry from the live demo at `tenantry.pengopal.com` and the README. They sign in with the public demo accounts (Ada, Cy, Gil). The redesign serves both evaluators and real customers equally.

## Product Purpose

Tenantry gives a B2B SaaS product the per-customer identity every customer eventually asks for: their own workspace and sign-in page, teams with roles, their brand, company login through their own identity provider, directory sync, and for the biggest customers a realm of their own. Success is a customer getting all of that without the product team rebuilding it, and without one customer ever seeing another's data.

## Positioning

Two tiers on one codebase, built on Keycloak: **Standard** workspaces are organizations in one shared realm (cheap, instant, one sign-on across workspaces); **Enterprise** workspaces get their own realm from a versioned template. A Standard workspace can move to Enterprise without anyone losing their account. Isolation is enforced at the token, the API and the database (row-level security), and proven by guarantee tests that run against the whole stack.

## Operating Context

- Each workspace lives on its own subdomain (`<slug>.tenantry.pengopal.com`); Admin is on `<slug>.portal.…`; sign-in pages are Keycloak's on `auth.…`, themed by Tenantry.
- Surfaces: the public welcome page and signup (web), Home and Projects (web), Admin (portal: People, Branding, Sign-in & security, Audit log, Advanced with Directory sync, Customer apps and the Keycloak console), and the login theme.
- Header search (Ctrl+K), notifications, an app switcher between Tenantry and Admin, a workspace switcher, light and dark themes.
- The live demo is rebuilt on each release and reset every night.

## Capabilities and Constraints

- **Tenant branding is product truth:** each workspace sets one colour (refused below 4.5:1 contrast with white, with a darker shade suggested) and a logo. The workspace colour drives the interactive colour of both apps and its sign-in page. Tenantry's own brand applies where no workspace applies (welcome page, signup, Tenantry-branded login) and in the frame around a workspace.
- Roles: owner, admin, member. Admin pages are for owners and admins only.
- Stack: React + Vite SPAs (`apps/web`, `apps/portal`), shared UI in `packages/ui`, shared app code in `packages/app-kit`, Keycloakify login theme (`apps/login-theme`). Strict TypeScript, Vitest tests next to the code.
- Decided 2026-11-16: the redesign replaces IBM Carbon. The Carbon-only and Carbon-token rules in AGENTS.md and ADR-0027 change with it, through a new ADR.

## Brand Commitments

- **Tenantry is a Pengopal product** (Pengopal Technologies, `pengopal.com`) and wears the Pengopal brand as PengOPA does (Pengopal/peng-opa PR #8): navy ink `#12224a`, navy-tinted greys, and the **opal mosaic** texture (`opal-mosaic.webp`, generated from the Pengopal logo) for the mark, opal type and the frame of primary buttons; opal blue `#2b77c0` for links and selection.
- **The mark stays the T of five tiles.** The one special tile, where the bar meets the stem, is painted with the opal mosaic; the other four are navy ink (light grounds) or near-white (dark grounds). It replaces the Carbon Blue 60 tile.
- Name: "Tenantry". Voice: plain, short sentences; says what something does, no hype. Concise: as little text as the task allows.
- **Look (chosen 2026-11-16): the category standard, played straight** — a clean, modern developer-SaaS look in the Pengopal palette. The craft bar is **Clerk, Vercel and Linear**.
- Technologies Tenantry is built on or connects to (Keycloak, Docker, Postgres, OIDC, SCIM, identity providers) are shown with their own logos where they are named, and actions carry icons where an icon helps recognition (especially in Admin).

## Evidence on Hand

- Real product: the running demo, its seeded workspaces (acme, globex, initech) and demo accounts; README screenshots in `docs/images/`.
- Brand assets: `packages/ui/assets/brand/` (current T-of-tiles SVGs), the opal mosaic and PengOPA's logo code in Pengopal/peng-opa PR #8.
- No customers, testimonials, pricing or benchmarks exist. Do not invent them.

## Product Principles

1. Isolation is the product: every surface should make it obvious which workspace you are in.
2. The customer's brand comes first inside their workspace; Tenantry's brand frames it, never competes with it.
3. Show the real mechanism (workspaces, tiers, sign-in) rather than claims.
4. Admin is a tool: scanable, consistent, quick for a task done a few times a week.

## Accessibility & Inclusion

Workspace colours are held to 4.5:1 against white. Light and dark themes are both supported. Keyboard reach and focus must survive the move off Carbon.

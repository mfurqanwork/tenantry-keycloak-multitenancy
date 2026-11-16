# Tenantry opal redesign: design

Date: 2026-11-16 · Status: draft for review

## 1. What and why

Tenantry moves off IBM Carbon onto the Pengopal brand, the same brand PengOPA wears (Pengopal/peng-opa PR #8). The look is the **category standard, played straight**: a clean, modern developer-SaaS product at the craft level of **Clerk, Vercel and Linear**. Text is short. Technologies are shown with their own logos where they are named, and actions carry icons where an icon helps recognition.

All four surfaces change: the welcome page and signup, Tenantry (Home, Projects), Admin, and the Keycloak login theme.

**Unchanged:** the information architecture (ADR-0027's two apps, their menus and routes), the API, permissions, and every behaviour. This is a visual and component replacement, not a feature change.

## 2. Decisions

| Topic             | Decision                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component base    | **Tailwind CSS v4 + Radix primitives**, with the components written in `packages/ui` the shadcn way (our code, not a dependency). PengOPA uses the same stack, so Pengopal products share one way of building.                                                                                                                                  |
| Type              | **Geist** and **Geist Mono**, as on PengOPA, from the installed `@fontsource-variable` packages (no CDN).                                                                                                                                                                                                                                       |
| Icons             | **Lucide** for interface icons. **Simple Icons** (CC0) for technology logos: Keycloak, Docker, PostgreSQL, OpenID, Okta, GitHub and others it carries. Where Simple Icons lacks a brand (Microsoft Entra ID), use the brand's own published SVG if its guidelines allow, otherwise the name alone.                                              |
| Palette           | Navy ink `#12224a`, navy-tinted greys `#4a5a86` / `#dfe3ef` / `#f5f6fa`, white pages; dark theme navy `#0e1a3a` ground, `#13224a` panels, `#eef2ff` text. Opal blue `#2b77c0` (4.7:1 on white) for links, focus and selection. Status colours as PengOPA's.                                                                                     |
| The opal mosaic   | `opal-mosaic.webp` paints the mark's centre tile, opal type on the welcome page, and the 2px frame of the primary button where Tenantry's own brand applies.                                                                                                                                                                                    |
| Workspace colour  | Product truth stays: inside a workspace, its colour is the interactive colour (primary buttons, active nav, links, focus). A workspace with **no colour set** gets Tenantry's look: the navy button with the opal frame. A workspace **with** a colour gets a solid button in that colour; the opal frame never mixes with a customer's colour. |
| Theme             | Light and dark, following the person's choice (system by default). The header is no longer forced dark: it follows the page.                                                                                                                                                                                                                    |
| The mark          | The T of five tiles stays. The centre tile is opal mosaic; the other four are navy ink on light grounds and `#eef2ff` on dark. New SVGs, favicon, app icons, README card and social preview, rendered with `pnpm brand:icons`.                                                                                                                  |
| Radius and shadow | Radius 6–12px from tokens; one soft shadow token for raised layers (menus, dialogs). No other shadows, no gradients except the opal texture.                                                                                                                                                                                                    |

## 3. Shared layer (`packages/ui`)

- **Tokens** in one stylesheet (`@theme` plus `:root` / `.dark`), with the workspace colour written into `--primary` and its derived shades at runtime (`packages/brand` keeps the contrast maths and computes hover and subtle shades).
- **Components**, each with tests: Button (primary, secondary, ghost, destructive, icon), Input, Textarea, Select, Checkbox, Switch, RadioGroup, Label and field error, Dialog, DropdownMenu, Tooltip, Tabs, Table, Badge (roles, tiers, status), Avatar, Toast, Skeleton, EmptyState, Kbd, and `TechLogo` (a name to its Simple Icons glyph, with the name as its accessible label).
- **Shell**: a Linear-style app frame: a left sidebar with the workspace switcher, nav items with icons, and the account menu at its foot; a slim top bar with search (Ctrl+K), notifications and the app switcher. Collapses to a drawer on phones.
- **The five page patterns keep their names and props** (`ListPage`, `DetailPage`, `SettingsPage`, `DashboardPage`, `WizardPage`), and so do `StatTile` and `TileGrid`, so page code changes mostly at the component level.
- `packages/app-kit` swaps its Carbon pieces (`ApiErrorNotification`, `FormDialog`, search, notifications) to the new components with the same props.

## 4. Surfaces

**Welcome page (base domain).** Top bar: mark, Docs, GitHub (with its logo), "Go to your workspace", and a framed **Create a workspace**. Hero: a two-line headline, one sentence, **Create a workspace** and **Try the demo**; beside it a real screenshot of Home from the demo, light or dark to match. Below: a row of technology logos (Keycloak, Postgres, Docker, OpenID Connect, SCIM); Standard vs Enterprise as two short cards; the three isolation layers (token, API, database) with icons; demo sign-ins; a footer. Every section is a few words, not paragraphs.

**Signup.** One centred card on the soft grey ground: workspace name, its address preview (`acme.tenantry.pengopal.com`), Create.

**Tenantry app.** Home: greeting, the setup checklist with icons and progress, number tiles, latest projects. Projects: a table with search, an icon **New project** button, empty state.

**Admin.**

- People: table with avatars, role badges and a row menu (icons for change role, console access, remove); **Invite** with an icon.
- Branding: colour and logo with a live preview of the button and the sign-in card.
- Sign-in & security: grouped settings with switches; company login shows the identity provider's logo.
- Audit log: a dense table, icons per event type.
- Advanced: Directory sync shows the Entra ID and Okta logos and a token card; Customer apps shows an icon per app type (web, single-page, mobile, machine); the Keycloak console link carries the Keycloak logo.

**Login theme (Keycloakify).** The same tokens and Geist; a centred card with the workspace's logo and colour, or Tenantry's mark and the opal frame when no workspace applies; identity provider buttons with their logos.

## 5. Rules that change (new ADR-0031)

ADR-0031 records the move off Carbon and replaces AGENTS.md's UI rules:

- Every screen starts from a `@tenantry/ui` page pattern (unchanged).
- Use `@tenantry/ui` components and Lucide icons only; technology logos only through `TechLogo`.
- Colour, spacing, radius, shadow and type come from tokens. Stylelint and an ESLint rule reject raw colours and sizes outside the token files, and imports of `@carbon/*`.
- The header follows the page's light or dark theme.

ADR-0027 gets a line pointing at ADR-0031 for the component system; its app split is unchanged.

## 6. Testing and checks

- Component tests in `packages/ui` (rendering, keyboard, focus, labels).
- Existing page tests keep passing. They query by role and label; any that query Carbon class names are rewritten to roles.
- `pnpm lint`, `typecheck`, `test`, `build`; the isolation and guarantee tests against the stack (no behaviour change expected).
- Visual check of every page in light and dark at desktop and phone width; `impeccable detect` on changed files; a fresh finish reviewer at the end; DESIGN.md written from the built system.
- Contrast: text and controls at 4.5:1 (3:1 for large text and UI parts) in both themes; workspace colours keep their existing 4.5:1 rule.

## 7. Delivery

Two pull requests, each releasable:

1. **Foundation and Tenantry:** ADR-0031, tokens, components, shell, page patterns, app-kit, the new mark and icons; then the welcome page, signup, Home, Projects and not-found. Admin and the login theme still render on the new page patterns.
2. **Admin and sign-in:** every portal page, the login theme, the README screenshots, the demo workspace rename (below), and the removal of Carbon from every `package.json`.

Released as **0.7.0** with a changelog entry per PR.

## 7a. The demo workspace is Pengopal

The seeded Standard workspace `acme` ("Acme") becomes **`pengopal`** ("Pengopal"), using the Pengopal palette as its workspace colour, so the live demo opens on `pengopal.tenantry.pengopal.com`. The seed, the live smoke check, the welcome page's demo list, the isolation tests that name the seeded workspace, `.env.example`, the README and the guides change with it. Unit-test fixtures that use `acme` as a sample slug stay as they are. `globex` (Standard) and `initech` (Enterprise) stay.

## 8. Out of scope

New features, route or API changes, marketing pages beyond the welcome page, and Phase 6c (metrics, rate limits, load tests).

**Pengopal apps on Tenantry sign-in** is its own phase with its own spec and ADR: Pengopal's own products, PengOPA first, offered to every workspace with "Sign in with Tenantry" as an optional login. Single sign-on and sign-out between Tenantry and PengOPA is checked by hand there, not in CI.

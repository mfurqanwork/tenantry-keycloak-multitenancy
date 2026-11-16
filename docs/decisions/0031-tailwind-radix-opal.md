# ADR-0031: Tailwind and Radix on the Pengopal brand

Status: Accepted · Date: 2026-11-16 · Supersedes ADR-0015's choice of Carbon

## Context

Tenantry wore IBM Carbon. It is now a Pengopal product, next to PengOPA, which is built with Tailwind CSS and Radix and wears the Pengopal brand: navy ink, navy-tinted greys, Geist, and an opal mosaic. Carbon's look and its token system don't fit that brand, and two ways of building UI across Pengopal's products cost twice.

## Decision

- **Tailwind CSS v4 and Radix primitives.** The components live in `packages/ui`, written the shadcn way: our code, not a dependency. The five page patterns, `StatTile`, `TileGrid` and `AppShell` keep their names and props.
- **Tokens in one stylesheet** (`packages/ui/src/styles/tokens.css`): navy ink `#12224a`, greys `#4a5a86` / `#dfe3ef` / `#f5f6fa` on white; dark theme `#0e1a3a` ground, `#13224a` panels, `#eef2ff` text; opal blue `#2b77c0` for links, focus and selection. Radius 6–12px and one soft shadow for raised layers. No gradients except the opal texture.
- **Type and icons:** Geist and Geist Mono from `@fontsource-variable` (no CDN); Lucide for the interface; Simple Icons (CC0) for technology logos, only through `TechLogo`.
- **Workspace colour stays the product's interactive colour.** `applyBrand` writes it into `--primary` and its shades. A workspace with no colour gets Tenantry's look: the navy button with a 2px opal frame. The frame never mixes with a customer's colour.
- **Theme:** light and dark follow the person's choice, system by default. The header follows the page; it is no longer forced dark.
- **Rules** (AGENTS.md): every screen starts from a page pattern; `@tenantry/ui` components and Lucide icons only; colour, spacing, radius, shadow and type from tokens. Stylelint and ESLint reject raw colours and sizes outside the token files, and imports of `@carbon/*`.

## Alternatives considered

- **Keep Carbon and theme it:** its components carry IBM's shape and density, and theming them to the brand fights the system.
- **A component library as a dependency (MUI, Mantine, Chakra):** another look to override, and not what PengOPA uses.

## Consequences

- One way of building UI across Pengopal's products.
- **The move ships in two releases.** The first rebuilds the shared layer and the Tenantry app; Admin and the login theme keep their Carbon page bodies on a legacy stylesheet (`@tenantry/ui/styles.scss`), loaded after the new one. Until then `applyBrand` writes both the new `--primary` set and the old `--cds-*` set, and the theme provider sets both `class="dark"` and `data-carbon-theme`. The second release moves Admin and the login theme, then deletes the legacy stylesheet, the `--cds-*` set and every Carbon dependency.
- Tailwind's base styles can restyle a few Carbon pieces in Admin during the first release.

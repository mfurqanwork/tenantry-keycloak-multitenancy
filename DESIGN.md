---
name: Tenantry
description: Per-customer identity for B2B SaaS, on the Pengopal brand; the customer's colour leads, Tenantry's navy and opal frame it.
colors:
  navy-ink: "#12224a"
  navy-ink-hover: "#1c3166"
  navy-ink-active: "#0b1633"
  opal-blue: "#2b77c0"
  paper: "#ffffff"
  mist: "#f5f6fa"
  haze: "#eef1f8"
  primary-tint: "#e8eef8"
  slate-ink: "#4a5a86"
  hairline: "#dfe3ef"
  danger-red: "#c42020"
  danger-wash: "#fef2f2"
  go-green: "#15803d"
  go-wash: "#ecfdf3"
  caution-amber: "#b45309"
  caution-wash: "#fffbeb"
  night-ground: "#0e1a3a"
  night-panel: "#13224a"
  night-raised: "#172a5a"
  night-tint: "#1b3363"
  night-sidebar: "#0a1430"
  night-hairline: "#2a3d78"
  night-text: "#eef2ff"
  night-muted-text: "#afc0f5"
  night-opal: "#6fb6f0"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body-lead:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.navy-ink-hover}"
  button-primary-active:
    backgroundColor: "{colors.navy-ink-active}"
  button-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.haze}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
  button-destructive:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-sm:
    height: "28px"
    padding: "0 10px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge-neutral:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.label}"
  badge-primary:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  badge-success:
    backgroundColor: "{colors.go-wash}"
    textColor: "{colors.go-green}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  badge-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-red}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "16px"
  dialog:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "24px"
    width: "512px"
  menu:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "4px"
  tooltip:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  table-head:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.slate-ink}"
    height: "36px"
    padding: "0 12px"
  sidebar:
    backgroundColor: "{colors.mist}"
    width: "240px"
  header:
    backgroundColor: "{colors.paper}"
    height: "56px"
---

# Design System: Tenantry

## Overview

**Creative North Star: "The Opal Frame"**

Tenantry is the category standard played straight: a clean, modern developer-SaaS interface in the Pengopal palette, held to the bar of Clerk, Vercel and Linear. Navy ink on white, navy-tinted greys, one soft shadow, Geist throughout. Nothing is decorative except the opal mosaic, and the mosaic appears in exactly three places: the one opal tile of the T mark, opal type in the welcome headline, and the 2px frame around Tenantry's own primary button.

The system is built around a handover. Inside a workspace the customer's colour replaces Tenantry's navy as the interactive colour (`applyBrand` writes `--primary` and its shades; the subtle tint, links and focus ring are derived from it per theme). Where no workspace applies (the welcome page, signup, Tenantry-branded sign-in) the navy button wears the opal frame. The frame and a customer's colour never appear on the same control: Tenantry's brand frames the customer's, it never competes with it.

Density is that of a tool used a few times a week: 14px body text, 36px controls, a 240px sidebar, tables with muted headers and hairline rows. Light and dark themes are first-class and follow the person's choice; the header follows the page's theme.

**Key Characteristics:**
- Navy ink (#12224a) on white; deep navy grounds (#0e1a3a) in dark mode.
- One interactive colour per page, and it belongs to the workspace when there is one.
- The opal mosaic is the only texture and the only gradient.
- Flat surfaces separated by hairlines; one soft navy-tinted shadow for layers that float.
- Geist and Geist Mono, semibold headings with tight tracking, no uppercase labels.
- Lucide icons for the interface; technology logos only through TechLogo.

## Colors

A restrained navy palette: one ink, a family of navy-tinted greys, opal blue for wayfinding, and quiet status washes.

### Primary
- **Navy Ink** (#12224a): Tenantry's primary and the page's text colour. Fills the primary button where no workspace colour applies, the selected switch, progress fills and the active tab underline. A workspace colour replaces it as `--primary`; the text colour stays navy.
- **Navy Ink Hover / Active** (#1c3166 / #0b1633): the primary button's hover and pressed fills. A workspace colour supplies its own pair from `@tenantry/brand`.
- **Primary Tint** (#e8eef8): the subtle wash behind selected table rows, primary and opal badges, and icon tiles on setup steps and feature lists. With a workspace colour it becomes that colour at 14% over the theme's background.

### Secondary
- **Opal Blue** (#2b77c0): links, the focus ring and text selection (at 22% alpha), 4.7:1 on white. In a workspace it becomes the workspace colour in light mode and a 35% white mix of it in dark mode. Also the fallback colour behind opal type.
- **Opal Mosaic** (texture, `opal-mosaic.webp`): the T mark's opal tile, opal type, and the primary button frame. Dimmed (`brightness(0.7) saturate(1.25)`) on light grounds so opal type holds 3:1.

### Neutral
- **Paper** (#ffffff): page ground, cards, popovers, inputs.
- **Mist** (#f5f6fa): secondary buttons, muted fills, table headers, the sidebar, the sign-in page ground.
- **Haze** (#eef1f8): hover fill for secondary buttons; the accent surface.
- **Slate Ink** (#4a5a86): secondary text, labels, icons at rest, placeholders.
- **Hairline** (#dfe3ef): every border and input stroke, and the unchecked switch track.
- **Night Ground / Panel / Raised / Tint** (#0e1a3a / #13224a / #172a5a / #1b3363): dark-mode page ground, cards and popovers, muted fills, and accent or tint surfaces.
- **Night Sidebar** (#0a1430), **Night Hairline** (#2a3d78), **Night Text** (#eef2ff), **Night Muted Text** (#afc0f5): the dark theme's sidebar, borders and two text levels.
- **Night Opal** (#6fb6f0): dark mode's primary, link and ring, with Night Ground as its foreground.

### Status
- **Danger Red** (#c42020, wash #fef2f2; dark #f87171 on #2a1214), **Go Green** (#15803d, wash #ecfdf3; dark #4ade80 on #0f2a1a), **Caution Amber** (#b45309, wash #fffbeb; dark #fbbf24 on #2a1f08): status badges, inline alerts, invalid fields and the destructive button. Status colour is text on its own wash, never a saturated fill except the destructive button.

### Named Rules
**The Workspace Leads Rule.** Inside a workspace the workspace colour is the only interactive colour. Tenantry's navy and opal step back to the frame: the mark, the switcher, the sidebar.

**The Frame Never Mixes Rule.** The opal frame appears only where no `data-brand` is set. A control never wears the mosaic and a customer's colour at once.

**The One Texture Rule.** No gradients anywhere except the opal mosaic, and the mosaic appears only on the mark, opal type and the primary button frame.

## Typography

**Display Font:** Geist Variable (with system-ui, sans-serif)
**Body Font:** Geist Variable (with system-ui, sans-serif)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace, monospace), for code snippets and keyboard keys

**Character:** One family, the Pengopal face, carrying everything from the welcome headline to table headers. Hierarchy comes from size and weight (400, 500, 600), not from a second typeface. Fonts ship from `@fontsource-variable`, never a CDN.

### Hierarchy
- **Display** (600, 2.25rem rising to 3rem from 640px, line-height 1.1, tight tracking): the welcome page headline only.
- **Headline** (600, 1.5rem, tight tracking): the page's one h1 in PageHeader, and section headings on the welcome page.
- **Title** (600, 1.25rem, tight tracking): the sign-in card heading and StatTile values (tabular figures). Card and dialog headings step down to 1.125rem or 1rem semibold.
- **Body** (400, 0.875rem): the working size for nearly everything: tables, forms, menus, descriptions. Inputs are 1rem below 768px (no zoom on focus) and 0.875rem above. Descriptions cap at `max-w-prose`.
- **Body Lead** (400, 1.125rem): the welcome page's supporting paragraph.
- **Label** (500, 0.75rem): StatTile labels, table headers, sidebar section headings, badges. Sentence case.

### Named Rules
**The Sentence Case Rule.** Labels, headers and section headings are sentence case at normal tracking. Hierarchy is weight and colour (Slate Ink), never uppercase and letter-spacing.

**The Tabular Figures Rule.** Tables and anything marked `data-numeric` use tabular numerals, so columns of counts and dates line up.

## Layout

Every screen starts from one of five page patterns (Dashboard, List, Detail, Settings, Wizard), each inside the `Page` column: centred, at most 72rem (1152px) wide, 24px between blocks, side padding 16px, then 24px from 640px, then 32px from 1024px, with 24px top padding rising to 32px. PageHeader opens every page: optional breadcrumb, the one h1 with an optional 22px icon, actions at the end of the row, and a one-line description.

The AppShell is a 240px sidebar (Mist ground, hairline right edge) beside a 56px sticky header (the page ground, hairline bottom). Below 1024px the sidebar becomes a 288px sheet opened from a menu button. Navigation rows step 2px apart; sections are separated by 16px and a small Slate Ink heading.

Spacing follows Tailwind's 4px step. The rhythm in use: 4px and 8px inside controls, 12px between tiles and form items, 16px card padding (20–24px for larger cards and dialogs), 24px between page blocks. StatTiles sit in a grid of one column, two from 640px, four from 1024px. Public pages (welcome, signup) use wider vertical sections (64px, 96px from 1024px); the sign-in page is a single 384px column on Mist.

## Elevation & Depth

Flat by default. Surfaces are separated by hairline borders and tonal steps (Paper, Mist, and in dark mode Ground, Panel, Raised). Exactly one shadow exists, a soft navy-tinted lift, and it marks layers that float above the page: dialogs, menus, popovers, selects, toasts, tooltips, the mobile sheet, the skip link, and the hero cards of the public pages (sign-in card, signup card, welcome screenshot).

### Shadow Vocabulary
- **Raised** (`box-shadow: 0 8px 24px -8px rgb(18 34 74 / 18%), 0 2px 6px -2px rgb(18 34 74 / 10%)`): every floating layer and the public pages' single hero card.

### Named Rules
**The One Shadow Rule.** There is one shadow, `shadow-raised`. In-page cards, tiles and tables carry a hairline border and no shadow.

## Shapes

Gently curved, never pill-shaped except where the form is round by nature. Controls and inputs are 8px; badges, breadcrumb focus targets and keys 6px; menus, popovers, tables, toasts and icon tiles 10px; cards, StatTiles, dialogs and the sign-in card 12px. Full rounding is kept for switches, avatars, progress bars and notification counts. Borders are 1px Hairline everywhere; the active tab is a 2px underline in the primary colour; the opal frame is a 2px border painted with the mosaic.

## Components

### Buttons
Quiet, compact and confident; colour is reserved for the one primary action.
- **Shape:** gently curved (8px), 36px tall, 14px side padding; small is 28px with 10px padding. On coarse pointers every size grows to at least 44px.
- **Primary:** the primary colour with its foreground. Where no workspace colour applies, navy ink inside a 2px opal-mosaic frame.
- **Hover / Focus:** hover and active step to the primary's hover and active shades; colours transition, nothing moves. Focus is the shared ring (below).
- **Secondary / Outline / Ghost:** Mist fill hovering to Haze; Paper with a hairline hovering to Mist; transparent hovering to Mist. Ghost is the header and toolbar button.
- **Destructive:** Danger Red fill, 90% opacity on hover, a red-tinted ring.
- **Icon-only** buttons are 36px square and must carry an `aria-label`. Icons inside buttons are 16px.

### Badges
- **Style:** 6px corners, 12px medium text, 2px by 6px padding, 12px icons.
- **Tones:** neutral (Mist, hairline, Slate Ink), primary (Primary Tint, navy text), success, warning and danger (status text on its wash), and opal, the Enterprise tier mark: Primary Tint with a 1px Opal Blue ring at 40%.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper (Night Panel in dark mode).
- **Shadow Strategy:** none in-page; Raised only for the public pages' hero card (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** 16px for StatTiles, 20px for SetupCard, 24px for feature and tier cards.

### Inputs / Fields
- **Style:** 1px Hairline stroke, Paper fill (muted at 40% in dark mode), 8px corners, 36px tall (40px on the sign-in pages), 12px side padding, Slate Ink placeholder.
- **Focus:** the border turns to the ring colour and the shared focus ring appears.
- **Error / Disabled:** invalid fields take a Danger Red border with a faint red ring; disabled fields drop to 50% opacity.

### Navigation
- **Sidebar:** Mist ground, 240px, 32px rows of 14px Slate Ink text with 16px icons, 2px apart; hover and the current page take the Haze surface and navy text (the current page in medium weight); nested groups indent behind a hairline and a rotating chevron. Section headings are 12px medium Slate Ink.
- **Header:** 56px, sticky, the page ground with a hairline bottom; it follows light and dark.
- **Tabs:** 14px medium Slate Ink triggers, 36px tall, a hairline under the list; the active tab takes navy text and a 2px primary underline.
- **Breadcrumbs:** 14px Slate Ink with 14px chevrons, hovering to navy.

### Tables
A hairline-bordered container with 10px corners, Mist header row of 12px medium Slate Ink labels, 36px tall; cells 12px by 10px. Rows hover to Mist at 60%; selected rows take Primary Tint.

### Overlays
Dialogs are 512px wide at most, 12px corners, 24px padding, Raised; they fade and zoom from 95% on open. Menus, selects and popovers are 10px with 4px inner padding. Tooltips invert: navy ink ground, white 12px text, 8px corners.

### Focus
**The One Ring Rule.** Every focusable element uses the same indicator: a solid 2px ring in the ring colour, offset 2px from the control on the page background. The ring is opal blue by default and the workspace colour (or its light tint in dark mode) inside a workspace.

### Workspace Identity (signature)
The workspace switcher at the top of the sidebar: the workspace logo, or a 28px rounded tile in the primary colour carrying the workspace's initial, beside the workspace name in semibold and the app name in Slate Ink. It is how every surface makes clear which workspace you are in.

### StatTile and SetupCard (signature)
A StatTile is one fact on a card: an optional 18px icon, a 12px label over a 20px semibold tabular value, a link in Opal Blue when the value leads somewhere. A SetupCard is a short checklist with a 6px progress bar in the primary colour; open steps sit beside a 32px Primary Tint icon tile, done steps are struck through in Slate Ink with a green check; the card disappears once every step is done.

### TechLogo
Technology logos (Keycloak, Docker, Postgres, OIDC, SCIM, identity providers) come only through TechLogo, 16px by default, with an optional 14px medium label beside them.

## Do's and Don'ts

### Do:
- **Do** start every screen from one of the five page patterns inside `Page`, with PageHeader holding the page's one h1.
- **Do** take every colour, radius, shadow and font from the tokens in `packages/ui/src/styles/tokens.css`; raw colours and sizes belong only there.
- **Do** let the workspace colour be the interactive colour inside a workspace, and keep the opal frame to surfaces with no workspace colour.
- **Do** use Lucide icons for the interface (16px in controls, 18–22px beside headings) and TechLogo for technology logos.
- **Do** use `focus-ring` on every custom focusable element.
- **Do** separate in-page surfaces with 1px hairlines and tonal steps, and keep `shadow-raised` for layers that float.
- **Do** design every surface in both light and dark themes.

### Don't:
- **Don't** add gradients, glows or textures other than the opal mosaic, or use the mosaic beyond the mark, opal type and the primary button frame.
- **Don't** put the opal frame or opal type on a control that carries a customer's colour.
- **Don't** use uppercase, letter-spaced labels or eyebrow text above headings; labels are sentence case.
- **Don't** add shadows beyond `shadow-raised`, or put a shadow on an in-page card.
- **Don't** import `@carbon/*` or bring in another component library.
- **Don't** recolour, stretch, outline or shadow the T mark, or change which tile is opal.

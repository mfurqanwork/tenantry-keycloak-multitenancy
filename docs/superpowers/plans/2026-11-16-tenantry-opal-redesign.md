# Tenantry opal redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Tenantry's four surfaces off IBM Carbon onto the Pengopal brand: Tailwind v4, Radix, Geist, Lucide and the opal mark. Ship it in two pull requests, released as 0.7.0.

**Architecture:**

- `packages/ui` gets one token stylesheet and shadcn-style components we own. The five page patterns, `StatTile`/`TileGrid` and `AppShell` keep their names and props, so pages change mostly at the component level.
- `packages/app-kit` swaps its Carbon pieces for the new components with the same props.
- PR 1 rebuilds the foundation and the Tenantry app (`apps/web`). Admin (`apps/portal`) and the login theme keep their Carbon page bodies, on a legacy stylesheet, until PR 2.

**Tech Stack:**

- Tailwind CSS 4.3 (`@tailwindcss/vite`)
- `radix-ui` 1.8, `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react`, `simple-icons`
- `@fontsource-variable/geist` and `geist-mono`
- `sonner`, `cmdk`
- React 19, Vitest 5, Testing Library

PengOPA (`C:\Users\furqa\Desktop\Pengopal Technologies\peng-opa\apps\web`) is the working reference for the same stack: `src/index.css`, `src/components/ui/*`, and `button.tsx` for the opal frame. Copy its patterns, not its product names.

**Spec:** `docs/superpowers/specs/2026-11-16-tenantry-opal-redesign-design.md`. Also read `PRODUCT.md` and `AGENTS.md`.

## Global Constraints

**Palette**

| Theme                   | Colour                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| Light                   | navy ink `#12224a`; greys `#4a5a86` / `#dfe3ef` / `#f5f6fa`; white page |
| Dark                    | ground `#0e1a3a`; panels `#13224a`; text `#eef2ff`                      |
| Links, focus, selection | opal blue `#2b77c0`                                                     |

**Brand and styling**

- `opal-mosaic.webp` paints three things only: the mark's centre tile, opal type on the welcome page, and the 2px frame of the primary button when **no workspace colour** is set. The opal frame never mixes with a customer's colour.
- Radius 6–12px, from tokens only. One soft shadow token for raised layers (menus, dialogs); no other shadows. No gradients except the opal texture.
- Type: Geist and Geist Mono from `@fontsource-variable`. No CDN.
- Icons: Lucide for the interface. Technology logos only through `TechLogo` (Simple Icons, CC0).
- Light and dark follow the person's choice (system by default). The header follows the page; it is no longer forced dark.

**Copy**

- Text is short. Sections are a few words, not paragraphs.
- Copy rules from `AGENTS.md`/`PRODUCT.md` apply. Use the project's existing strings where one already says the same thing.

**Behaviour and checks**

- Routes, the API, permissions and behaviour are unchanged. Existing page tests keep passing. Any that query Carbon class names are rewritten to query roles and labels.
- Contrast: text and controls at least 4.5:1 (3:1 for large text and UI parts) in both themes. Workspace colours keep their existing 4.5:1 rule (`@tenantry/brand`).
- Every task ends with `pnpm lint && pnpm typecheck && pnpm test` green for the packages it touched.
- Conventional Commits. Each PR adds a line under Unreleased in `CHANGELOG.md`.
- No attribution lines in commits or PR descriptions. Don't push or merge without the user's go-ahead.

## Rulings (decided while planning)

- **PR 1 keeps a legacy Carbon stylesheet.** `@tenantry/ui/styles.scss` stays, renamed in source to `src/styles/carbon-legacy.scss` and exported at the same path, so `apps/portal` and `apps/login-theme` still render.
  - The new stylesheet is `@tenantry/ui/styles.css`. The portal loads both, new first, then legacy.
  - PR 2 deletes the legacy one.
  - Cost if wrong: Tailwind's preflight could restyle some portal Carbon pieces for one release.
- **`applyBrand` writes both token sets in PR 1:** the new `--primary…` properties and the old `--cds-…` ones, so Admin's Carbon buttons keep the workspace colour. PR 2 drops the `--cds-…` set.
- **The theme provider sets both `class="dark"` and `data-carbon-theme` in PR 1;** PR 2 drops the attribute.
- **Icon props take any icon component:**

  ```ts
  type IconComponent = ComponentType<{
    size?: number | string;
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
  ```

  Lucide and Carbon icons both satisfy it, so the portal compiles unchanged in PR 1. It replaces `CarbonIconType` in every pattern prop.

- **Microsoft Entra ID has no Simple Icons glyph.** `TechLogo` shows its name alone until a published SVG with permissive guidelines is confirmed. Same for SCIM.
- **The demo workspace colour is opal blue `#2b77c0`,** so the demo shows a workspace colour, distinct from Tenantry's own framed navy.

## Review Focus

1. **A very light or very dark workspace colour.** The primary button keeps a readable label and a visible focus ring in both themes. Pinned in Task 4.
2. **Switching theme while a workspace colour is applied.** The workspace colour stays; the opal frame does not appear. Pinned in Task 4.
3. **Keyboard only.** Ctrl+K opens search, Escape closes it and returns focus, and the phone drawer traps and returns focus. Pinned in Tasks 9 and 10.
4. **A long workspace name or many workspaces** in the sidebar switcher. Long names truncate with the full name available, and the list scrolls. Pinned in Task 9.
5. **A portal Carbon page in PR 1** still gets the workspace colour and readable dark mode. Pinned in Task 13.

---

# PR 1: Foundation and Tenantry

Branch: `feat/opal-redesign-foundation` from `main` (after PR #13 merges). The first commit carries the uncommitted `PRODUCT.md`, the spec and `.impeccable/`.

### Task 1: ADR-0031 and the rules

**Files:**

- Create: `docs/decisions/0031-tailwind-radix-opal.md`
- Modify: `AGENTS.md` (Layout line for `packages/ui`; the whole "UI rules" section), `docs/decisions/0027-tenantry-and-admin.md` (one line pointing at ADR-0031), `docs/decisions/0015-react-vite-carbon.md` (Status: superseded by ADR-0031), `docs/decisions/README.md` (index row)
- Commit also: `PRODUCT.md`, `docs/superpowers/specs/2026-11-16-tenantry-opal-redesign-design.md`, `.impeccable/`, this plan

**ADR content:** spec §2 and §5. Include the PR 1 transition (legacy stylesheet, both token sets) as Consequences.

**AGENTS.md UI rules** become, verbatim from spec §5:

- Every screen starts from a `@tenantry/ui` page pattern.
- Use `@tenantry/ui` components and Lucide icons only; technology logos only through `TechLogo`.
- Colour, spacing, radius, shadow and type come from tokens. Stylelint and ESLint reject raw colours and sizes outside the token files, and imports of `@carbon/*`.
- The header follows the page's light or dark theme.

Add one line: until 0.7.0, Admin and the login theme still use the legacy Carbon stylesheet.

- [ ] **Step 1:** Write the ADR and edit the files above.
- [ ] **Step 2:** Run `pnpm prettier --check AGENTS.md docs` and expect PASS.
- [ ] **Step 3:** Commit: `docs: ADR-0031, Tailwind and Radix on the Pengopal brand`

### Task 2: Tokens, Tailwind and `cn`

**Files:**

- Create: `packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/index.css`, `packages/ui/src/lib/cn.ts`, `packages/ui/src/lib/cn.test.ts`, `packages/ui/src/styles/tokens.test.ts`, `packages/ui/assets/brand/opal-mosaic.webp` (copy from `.impeccable/reference/opal-mosaic.webp`)
- Rename: `packages/ui/src/styles/index.scss` → `packages/ui/src/styles/carbon-legacy.scss`
- Modify: `packages/ui/package.json`, root `pnpm-lock.yaml`

**package.json**

- Exports: `"./styles.css": "./src/styles/index.css"` and `"./styles.scss": "./src/styles/carbon-legacy.scss"`.
- Add dependencies at PengOPA's versions: `tailwindcss`, `tw-animate-css`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `cmdk`, plus `simple-icons` (latest 15.x).

**Interfaces:**

- Produces:
  - `cn(...inputs: ClassValue[]): string`, exported from `@tenantry/ui`.
  - CSS variables, the same names as PengOPA: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--primary-hover`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--input`, `--ring`, `--link`, `--destructive`, `--success`, `--warning`, `--radius-sm/md/lg/xl`, `--shadow-raised`, `--opal-mosaic: url(...)`.
  - `.dark` overrides.
  - `@theme inline` mapping to Tailwind colours.
  - The `.opal-frame` utility, active only under `:root:not([data-brand])`.
  - The `.opal-text` utility.

- [ ] **Step 1: Write the failing tests.**
  - `cn.test.ts`:
    - `expect(cn('px-2', 'px-4')).toBe('px-4')`
    - `expect(cn('a', false && 'b')).toBe('a')`
  - `tokens.test.ts` reads `tokens.css` as text and parses `--name: #hex` in `:root` and `.dark`. It asserts:
    - light `--foreground` is `#12224a` and `--background` is `#ffffff`;
    - dark `--background` is `#0e1a3a`, `--card` is `#13224a` and `--foreground` is `#eef2ff`;
    - `--link` is `#2b77c0`;
    - with `contrastRatio` from `@tenantry/brand`:
      - foreground and muted-foreground on background, in each theme, are ≥ 4.5;
      - link on background is ≥ 4.5 in light;
      - the dark-theme link value on the dark background is ≥ 4.5.
    - The `.opal-frame` rule's selector contains `:not([data-brand])`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- cn tokens` and expect FAIL (files missing).
- [ ] **Step 3:** Write the files.
  - The dark link may be a lighter opal so it passes 4.5 on `#0e1a3a`.
  - `index.css` imports, in order: `tailwindcss`, `tw-animate-css`, both fontsource packages, `./tokens.css`.
  - The body uses `bg-background text-foreground font-sans`.
- [ ] **Step 4:** Run the same command and expect PASS. Then run `pnpm --filter @tenantry/ui build` and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): Pengopal tokens on Tailwind v4`

### Task 3: Theme provider without Carbon

**Files:**

- Modify: `packages/ui/src/theme/ThemeProvider.tsx`, `ThemeProvider.test.tsx`, `packages/ui/src/index.ts`

**Interfaces:**

- Produces:
  - `type ResolvedTheme = 'light' | 'dark'`.
  - `useThemePreference(): { preference: ThemePreference; resolved: ResolvedTheme; setPreference(p): void }`.
  - `TenantryThemeProvider` keeps its name.
  - `CarbonTheme` is removed from exports; update its users (`AppShell.tsx`).

- [ ] **Step 1: Write the failing tests.**
  - `'dark preference puts class dark on <html>'`: `expect(document.documentElement).toHaveClass('dark')`, and `data-carbon-theme` is `'g100'`.
  - `'system follows prefers-color-scheme'`: mock `matchMedia` to dark → class `dark`; fire change to light → class removed.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- ThemeProvider` and expect FAIL.
- [ ] **Step 3:** Implement. Drop `GlobalTheme`. Toggle `.dark` and set `data-carbon-theme` (`g100`/`g10`) for the legacy sheet.
- [ ] **Step 4:** Run it and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): theme provider without Carbon`

### Task 4: Workspace colour on the new tokens

**Files:**

- Modify: `packages/brand/src/color.ts` (+ test), `packages/ui/src/brand.ts`, `packages/ui/src/brand.test.ts`

**Interfaces:**

- Produces:
  - `BrandTokens` gains `subtle: string`, a tint of the colour at ≥ 3:1 against neither (used for selected rows and active nav backgrounds), and `foreground: string`, the label colour on `interactive`: `#ffffff` unless contrast < 4.5, then `#12224a`.
  - `applyBrand(tokens: BrandTokens | null, target = document.body)`:
    - writes `--primary`, `--primary-hover`, `--primary-active`, `--primary-foreground`, `--primary-subtle`, `--ring`, `--link`, and the legacy `--cds-*` set;
    - sets `document.documentElement.dataset.brand = 'workspace'` when tokens are given, and removes it and every property on `null`.
  - `BRAND_PROPERTIES` lists both sets.

- [ ] **Step 1: Write the failing tests.**
  - `brandTokens('#ffff00').foreground` has `contrastRatio` ≥ 4.5 against `.interactive`.
  - `brandTokens('#0a0a0a')` likewise.
  - `applyBrand(brandTokens('#2b77c0'))`:
    - `document.body.style.getPropertyValue('--primary')` is truthy;
    - `document.documentElement.dataset.brand` is `'workspace'`;
    - `--cds-button-primary` is set.
  - `applyBrand(null)` removes every name in `BRAND_PROPERTIES` and `data-brand`.
  - **Review Focus 2:** after `applyBrand(tokens)`, toggling `.dark` on `<html>` leaves `--primary` on body unchanged and `data-brand` present.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/brand test && pnpm --filter @tenantry/ui test -- brand` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it and expect PASS. Also run `pnpm --filter @tenantry/login-theme test` (it calls `applyBrand`) and expect PASS.
- [ ] **Step 5:** Commit: `feat(brand): workspace colour drives --primary; opal frame only without one`

### Task 5: Form and action components

**Files:** Create in `packages/ui/src/components/`, one `.tsx` each plus `form.test.tsx`: `button`, `input`, `textarea`, `label`, `field-error`, `checkbox`, `switch`, `radio-group`, `select`. Export all from `index.ts`.

**Interfaces:**

- Produces:
  - `Button({ variant?: 'primary'|'secondary'|'ghost'|'destructive'|'outline', size?: 'sm'|'md'|'icon', asChild?: boolean, ...ButtonHTMLAttributes })`.
    - Primary is `bg-primary text-primary-foreground` plus the `opal-frame` class.
    - An `icon` size button requires `aria-label` (a TypeScript overload).
    - `data-variant` reflects the variant.
  - `Input`, `Textarea`, `Label`: native props.
  - `FieldError({ id, children })`: renders `role="alert"`.
  - `Checkbox`, `Switch`, `RadioGroup`/`RadioGroupItem`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`: Radix wrappers, as in PengOPA.

- [ ] **Step 1: Write the failing tests** (`form.test.tsx`):
  - Button: `getByRole('button', {name:'Save'})` has `data-variant="primary"` and class `opal-frame`. `disabled` blocks `onClick`.
  - Icon button: `<Button size="icon" aria-label="Delete"><Trash2/></Button>` is found by name.
  - Label: Label + Input with `htmlFor` gives `getByLabelText('Name')`.
  - FieldError: `getByRole('alert')` has the text.
  - Switch: `user.keyboard('[Space]')` toggles `aria-checked`.
  - Select: open with the keyboard and choose an option, and `onValueChange` is called with its value.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- form` and expect FAIL.
- [ ] **Step 3:** Implement, following PengOPA's `button.tsx` for the opal frame.
- [ ] **Step 4:** Run it and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): form and button components`

### Task 6: Overlay and display components

**Files:** Create in `packages/ui/src/components/`: `dialog`, `dropdown-menu`, `tooltip`, `tabs`, `table`, `badge`, `avatar` (replaces `patterns/Avatar.tsx`), `toast` (sonner `Toaster` + `toast`), `skeleton`, `kbd`, `sheet` (the phone drawer), plus `display.test.tsx`.

**Interfaces:**

- Produces:
  - `Badge({ tone?: 'neutral'|'primary'|'success'|'warning'|'danger'|'opal' })`. `opal` is used for the Enterprise tier.
  - `Avatar({ name, src?, size?: 'sm'|'md' })` keeps `initials(name)` and its export.
  - Shadcn's names elsewhere: `Dialog*`, `DropdownMenu*`, `Tooltip*`, `Tabs*`, `Table*`, `Sheet*`.

- [ ] **Step 1: Write the failing tests:**
  - Dialog: opening moves focus inside, Escape closes, and focus returns to the trigger.
  - DropdownMenu: arrow keys move between `menuitem`s.
  - Tabs: arrow right selects the next tab (`aria-selected`).
  - Avatar: the existing `pieces.test.tsx` initials cases still pass.
  - Badge: renders its text.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- display pieces` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): dialog, menu, tabs, table and display components`

### Task 7: `TechLogo`

**Files:**

- Create: `packages/ui/src/components/tech-logo.tsx`, `tech-logo.test.tsx`

**Interfaces:**

- Produces:

  ```ts
  type TechName = 'keycloak'|'docker'|'postgresql'|'openid'|'okta'|'github'|'react'|'nestjs'|'entra'|'scim'
  TechLogo({ name: TechName, size?: number = 16, withLabel?: boolean, className?: string })
  ```

  - It takes the glyph path from `simple-icons` (`siKeycloak`, `siDocker`, `siPostgresql`, `siOpenid`, `siOkta`, `siGithub`, `siReact`, `siNestjs`).
  - It renders `<svg role="img" aria-label={title}>` filled with `currentColor` (monochrome, so it suits both themes).
  - `entra` and `scim` have no glyph: they render the name as text. With `withLabel`, the name follows the glyph.

- [ ] **Step 1: Write the failing tests:**
  - `getByRole('img', { name: 'Keycloak' })` exists for `name="keycloak"`.
  - `name="entra"` renders `getByText('Microsoft Entra ID')` and no `img`.
  - `withLabel` gives both.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- tech-logo` and expect FAIL.
- [ ] **Step 3:** Implement it, importing named icons only (tree-shaken).
- [ ] **Step 4:** Run it and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): TechLogo for technology logos`

### Task 8: Page patterns on the new components

**Files:**

- Modify: every file in `packages/ui/src/patterns/` (`PageHeader`, `ListPage`, `DetailPage`, `SettingsPage`, `DashboardPage`, `WizardPage`, `SetupCard`, `EmptyState`, `tiles`)
- Create: `packages/ui/src/icon.ts` (`IconComponent`)
- Tests: `patterns.test.tsx`, `crumbs.test.tsx`, `tiles.test.tsx`, `pieces.test.tsx`

**Interfaces:**

- Consumes: Tasks 5–6.
- Produces: the same component names and props as today, with every `icon?: CarbonIconType` replaced by `icon?: IconComponent`.
  - DetailPage tabs use `Tabs`.
  - The SettingsPage save bar uses `Button` (discard: `secondary`; save: `primary`, with "Saving…" while `saving`).
  - The WizardPage step list is an ordered list with `aria-current="step"`.
  - EmptyState takes the same props.

- [ ] **Step 1:** Rewrite any assertion in the four test files that queries a `cds--` class to query by role or label. Add `'patterns accept a Lucide icon'`: render `ListPage` with `icon={FolderKanban}` and expect an `svg[aria-hidden]` in the heading row.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- patterns crumbs tiles pieces` and expect FAIL on the new test.
- [ ] **Step 3:** Rewrite the patterns with Tailwind classes and the new components. Carbon is no longer imported in `packages/ui/src` (only `carbon-legacy.scss` uses it).
- [ ] **Step 4:** Run it and expect PASS. Also run `grep -r "@carbon" packages/ui/src --include=*.tsx --include=*.ts` and expect no output.
- [ ] **Step 5:** Commit: `feat(ui): page patterns on the new components`

### Task 9: The shell

**Files:**

- Modify: `packages/ui/src/shell/AppShell.tsx`, `HeaderSwitcher.tsx`, `AppShell.test.tsx`, `AppShell.redesign.test.tsx`, `switchers.test.tsx`
- Create: `packages/ui/src/shell/TenantryMark.tsx`

**Interfaces:**

- Consumes: Tasks 3, 5, 6.
- Produces: `AppShellProps` unchanged (`NavItem.icon` becomes `IconComponent`). Layout:
  - **Left sidebar (lg and up), top to bottom:**
    - workspace switcher, with its logo or initial, name and chevron; opens a `DropdownMenu` of `workspaces`;
    - nav items with icons; `section` headings; `children` as nested items; `crossApp`/`external` marked with an `ArrowUpRight` icon;
    - account menu at the foot (name, email, theme choice: System/Light/Dark through `useThemePreference`, Sign out).
  - **Slim top bar:** `headerActions` (search, notifications) and the app switcher (`apps`).
  - **Below lg:** a menu button opens the sidebar in a `Sheet`.
  - `TenantryMark({ variant: 'mark'|'logo' })` shows the light or dark SVG from `assets/brand/` by resolved theme. The shell shows it when `logoUrl` is null.
  - `brandColor` is applied through `applyBrand(brandTokens(c))` as today.

- [ ] **Step 1:** Update the three test files so assertions query roles. Add:
  - `'nav marks the current page'`: `getByRole('link', {name:'Projects'})` has `aria-current="page"`.
  - `'phone drawer traps and returns focus'` (Review Focus 3): set `matchMedia` below lg, open with `getByRole('button',{name:'Open menu'})`, Escape closes, and focus is back on the button.
  - `'long workspace names truncate and keep the full name'` (Review Focus 4): with a 60-character name, the switcher item has `title` equal to the full name, and a list of 30 workspaces renders inside a scrollable menu (`max-h-*` class present).
  - `'theme menu sets the preference'`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- AppShell switchers` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it and expect PASS.
- [ ] **Step 5:** Commit: `feat(ui): sidebar shell with workspace switcher`

### Task 10: app-kit swaps

**Files:**

- Modify: `packages/app-kit/src/ApiErrorNotification.tsx`, `FormDialog.tsx`, `RouterLink.tsx`, `search/WorkspaceSearch.tsx`, `notifications/NotificationsBell.tsx`, their tests, `packages/app-kit/package.json` (remove `@carbon/*`)

**Interfaces:**

- Consumes: Tasks 5–6.
- Produces: the same exports and props.
  - `ApiErrorNotification`: an inline alert (`role="alert"`) with the problem title and detail.
  - `FormDialog`: `Dialog` with a form, a primary submit and a secondary cancel. It keeps its props.
  - `WorkspaceSearch`:
    - a top-bar button showing `Search` and `Kbd` "Ctrl K";
    - **Ctrl+K or ⌘K** opens a `cmdk` command dialog over `searchResults`;
    - Enter follows the hit; Escape closes and returns focus.
  - `NotificationsBell`: an icon button with a count badge, plus a `DropdownMenu` list.

- [ ] **Step 1: Write the failing tests:**
  - `'Ctrl+K opens search and Escape returns focus'` (Review Focus 3): `user.keyboard('{Control>}k{/Control}')` shows `getByRole('dialog', {name: 'Search'})`; Escape hides it, and focus goes back to the search button.
  - Existing search, notifications and dialog tests rewritten to roles.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/app-kit test` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm --filter @tenantry/app-kit test` and expect PASS. Then run `pnpm --filter @tenantry/portal test` and expect PASS: the portal uses these pieces and still renders.
- [ ] **Step 5:** Commit: `feat(app-kit): shared pieces on the new components`

### Task 11: Welcome page and signup

**Files:**

- Modify: `apps/web/src/features/welcome/WelcomeRoute.tsx`, `DemoSignIns.tsx`, `GoToWorkspace.tsx`, `apps/web/src/features/signup/SignupRoute.tsx`, `SignupApp.tsx`, their tests, `apps/web/src/main.tsx` (import `@tenantry/ui/styles.css`), `apps/web/vite.config.ts` (add `@tailwindcss/vite`; drop the scss `quietDeps`), `apps/web/package.json` (remove `@carbon/*` and `sass`; add `@tailwindcss/vite`, `lucide-react`)
- Delete: `apps/web/src/app.scss`
- Screenshot: `apps/web/public/welcome/home-light.png`, `home-dark.png` (Home from the demo, captured in Task 14 Step 3; use placeholders until then)

**Content** (spec §4):

- **Top bar:** `TenantryMark` logo, Docs, GitHub (`TechLogo github`), "Go to your workspace", and a primary **Create a workspace**.
- **Hero:**
  - a two-line headline with "Tenantry" in `.opal-text`;
  - one sentence;
  - **Create a workspace** and **Try the demo**;
  - the Home screenshot matching the theme (`<picture>` with `prefers-color-scheme`).
- **Logo row:** Keycloak, PostgreSQL, Docker, OpenID Connect, SCIM.
- **Two cards:** Standard and Enterprise (`Badge tone="opal"` on Enterprise).
- **Three isolation layers with Lucide icons:** Token (`KeyRound`), API (`ShieldCheck`), Database (`Database`).
- **Demo sign-ins** (existing data), then the footer.
- **Signup:** one centred card on `bg-muted`, with workspace name, the live address preview (`<slug>.tenantry.pengopal.com` from the existing host helper) and **Create**.

- [ ] **Step 1:** Update the tests to roles and add:
  - `'welcome shows technology logos'`: `getByRole('img',{name:'Keycloak'})`.
  - `'Create a workspace goes to signup'`.
  - `'signup previews the address'`: typing `Pengopal Labs` shows `pengopal-labs.` in the preview.
  - All existing signup validation and error tests are kept.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/web test -- welcome signup` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it and expect PASS. Then run `pnpm --filter @tenantry/web build` and expect PASS.
- [ ] **Step 5:** Commit: `feat(web): welcome page and signup on the Pengopal brand`

### Task 12: Home, Projects, not found, patterns

**Files:**

- Modify: `apps/web/src/features/home/HomeRoute.tsx`, `Checklist.tsx`, `apps/web/src/features/projects/ProjectsRoute.tsx`, `apps/web/src/features/not-found/NotFoundPage.tsx`, `apps/web/src/features/patterns/PatternsRoute.tsx`, `apps/web/src/App.tsx`, `Root.tsx`, `TenantApp.tsx`, their tests

**Content:**

- **Home:**
  - "Good morning, <first name>" (by local hour);
  - the checklist as `SetupCard`, with a Lucide icon per step and a progress bar (`role="progressbar"`, `aria-valuenow`);
  - `StatTile`s;
  - latest projects.
- **Projects:** `ListPage` with a `Table`, a search `Input` filtering by name, an icon **New project** (`Plus`) opening the existing `FormDialog`, and `EmptyState` (`FolderKanban`).
- **Nav icons in `App.tsx`:** Home `House`, Projects `FolderKanban`, Admin `ShieldUser`.

- [ ] **Step 1:** Update the tests to roles and add:
  - `'checklist shows progress'`: `getByRole('progressbar')` has `aria-valuenow` equal to the done count.
  - `'projects search filters rows'`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/web test` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm --filter @tenantry/web test` and `pnpm --filter @tenantry/web build`; expect PASS. Also run `grep -r "@carbon" apps/web/src` and expect no output.
- [ ] **Step 5:** Commit: `feat(web): Home and Projects on the new patterns`

### Task 13: Admin and login keep rendering; lint rules

**Files:**

- Modify: `apps/portal/src/main.tsx` (import `@tenantry/ui/styles.css`, then `@tenantry/ui/styles.scss`), `apps/portal/vite.config.ts` (`@tailwindcss/vite`)
- Modify: `stylelint.config.mjs`:
  - lint `**/*.css` too;
  - `color-no-hex` and `color-named: never`, except in `packages/ui/src/styles/tokens.css`;
  - keep the unit, shadow and radius bans outside the token file;
  - `selector-class-pattern` allows Tailwind's utilities in `.css`.
- Modify: `eslint.config.mjs`: `@carbon/*` is in `no-restricted-imports` for `packages/ui/src/**` (except none), `packages/app-kit/**` and `apps/web/**`.
- Tests: `apps/portal/src/features/branding/*.test.tsx` (existing)

- [ ] **Step 1: Write the failing test.** `packages/ui/src/brand.test.ts` gets `'legacy Carbon pages keep the workspace colour'` (Review Focus 5): after `applyBrand(brandTokens('#2b77c0'))`, `--cds-button-primary` equals `tokens.interactive`, and `<html>` has `data-carbon-theme` from the provider in dark mode, `g100`.
- [ ] **Step 2:** Run `pnpm --filter @tenantry/ui test -- brand` and expect PASS if Tasks 3–4 are right; otherwise fix those tasks.
- [ ] **Step 3:** Make the config edits. Add a throwaway `import '@carbon/react'` in an `apps/web` file and check `pnpm --filter @tenantry/web lint` FAILs, then remove it.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and expect PASS.
- [ ] **Step 5:** Commit: `chore: lint rules for tokens and no Carbon in the new code`

### Task 14: PR 1 finish

- [ ] **Step 1:** Run `pnpm dev:stack`, then `pnpm smoke`, and expect PASS. Run `pnpm test:isolation` and expect PASS (no behaviour change).
- [ ] **Step 2:** Visual check in the in-app browser. Check each page in light and dark, at 1440 and 375 wide: welcome, signup, Home, Projects, not found, and one Admin page (it should render with legacy body and the new shell). Fix what looks broken.
- [ ] **Step 3:** Capture Home light and dark from the demo into `apps/web/public/welcome/`.
- [ ] **Step 4:** Run `impeccable detect` on the changed files and fix the material findings.
- [ ] **Step 5:** `CHANGELOG.md` Unreleased: under "Changed", "Tenantry and the welcome page wear the Pengopal brand: new components, sidebar shell, Geist, Lucide and technology logos (ADR-0031)". Commit: `docs: changelog for the redesign foundation`.
- [ ] **Step 6:** Whole-branch review by a fresh reviewer. Then ask the user before pushing and opening PR 1.

---

# PR 2: Admin and sign-in

Branch: `feat/opal-redesign-admin` from `main` after PR 1 merges.

### Task 15: People, Branding, Sign-in & security

**Files:** `apps/portal/src/features/people/*`, `branding/*`, `security/*`, their tests.

- **People:** `Table` with `Avatar`; role `Badge`s; a row `DropdownMenu` with icon items: Change role (`UserCog`), Console access (`TechLogo keycloak`), Remove (`Trash2`, destructive). **Invite** has the `UserPlus` icon.
- **Branding:** colour and logo, with a live preview card showing a primary button and a mini sign-in card in the chosen colour. Use `brandTokens`; the preview gets no opal frame when a colour is set.
- **Sign-in & security:** `SettingsPage` groups with `Switch`es. Company login shows the identity provider's `TechLogo`.

Tests:

- `'row menu offers change role, console access and remove'`;
- `'branding preview uses the chosen colour'`: the preview button's style `--primary` equals `tokens.interactive`;
- existing tests rewritten to roles.

Commit: `feat(portal): people, branding and security on the new components`.

### Task 16: Audit log and Advanced

**Files:** `apps/portal/src/features/audit/*`, `scim/*`, `applications/*`, `not-allowed/*`, `apps/portal/src/App.tsx` nav icons, and the dashboard's console link.

- **Audit log:** a dense `Table` with a Lucide icon per event family (member `User`, app `AppWindow`, tenant `Building2`, security `ShieldCheck`, scim `RefreshCw`).
- **Directory sync:** Entra ID and Okta via `TechLogo`, and a token card with copy and Mono text.
- **Customer apps:** an icon per type: web `Globe`, single-page `PanelsTopLeft`, mobile `Smartphone`, machine `Cpu`.
- **Keycloak console link:** carries `TechLogo keycloak`.

Tests:

- `'audit rows show an icon per event'`;
- `'directory sync names Entra ID and Okta'`;
- `'apps list shows the type icon'`;
- existing tests rewritten.

Commit: `feat(portal): audit log and advanced pages on the new components`.

### Task 17: Login theme

**Files:** `apps/login-theme/src/login/Template.tsx`, `KcPage.tsx`, `login.scss` → `login.css`, its tests, and `apps/login-theme/vite.config.ts`.

- Same tokens and Geist (`@tenantry/ui/styles.css`).
- A centred card with the workspace's logo and colour, or `TenantryMark` and the opal-framed button when no workspace colour applies.
- Identity provider buttons carry `TechLogo` for known aliases (`okta`, `github`, `entra`, `keycloak`), otherwise a `KeyRound` icon.

Tests:

- the existing `brand.test.tsx` and `tenant-brand.test.ts`;
- new: `'provider button shows its logo'`.

Run `pnpm --filter @tenantry/login-theme build:jar` and expect PASS.

Commit: `feat(login-theme): Pengopal brand sign-in`.

### Task 18: The demo workspace is Pengopal

**Files:**

- `apps/ops/src/seed/seed.ts` and `memory-dns.ts`;
- `.env.example`;
- `apps/web/src/features/welcome/DemoSignIns.tsx`;
- `scripts/` (the live smoke check);
- `tests/isolation` files naming the seeded workspace;
- `README.md` and `docs/guides/*`;
- ADR-0022's example.

Rename the seeded `acme` ("Acme") to `pengopal` ("Pengopal") with brand colour `#2b77c0`. Unit-test fixtures that use `acme` as a sample slug stay as they are, so do not touch `*.test.ts(x)`/`*.itest.ts` fixtures unless they read the seed.

Test: the seed test asserts slug `pengopal`, name `Pengopal` and colour `#2b77c0`. Then run `grep -rn "acme" --exclude=*.test.* --exclude=*.itest.* apps scripts tests docs README.md .env.example` and expect only intentional hits.

Commit: `feat(seed): the demo workspace is Pengopal`.

### Task 19: Carbon out, docs, release

- Delete `packages/ui/src/styles/carbon-legacy.scss` and its export. Remove the `--cds-*` set from `applyBrand` and `data-carbon-theme` from the provider (update the Task 4 and Task 13 tests).
- Remove every `@carbon/*`, `@ibm/plex` and `sass` from every `package.json`. ESLint bans `@carbon/*` repo-wide. Check with `grep -rn "@carbon\|cds--" apps packages --include=*.ts* --include=*.css --include=*.json -l | grep -v node_modules` and expect no output.
- README screenshots retaken (light and dark) for every page shown. `DESIGN.md` is written from the built system (the `impeccable:impeccable-documenter` agent). A fresh `impeccable:impeccable-finish-reviewer` pass.
- `CHANGELOG.md`: under Unreleased "Changed", "Admin and sign-in on the Pengopal brand; Carbon removed; the demo workspace is Pengopal".
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then `pnpm smoke` and `pnpm test:isolation`, all PASS.
- Commit: `chore: remove Carbon`.
- Ask the user before pushing and opening PR 2. After it merges, `pnpm release 0.7.0` (the user pushes the tag).

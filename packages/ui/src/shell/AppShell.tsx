import { ArrowUpRight, Check, ChevronRight, ChevronsUpDown, LogOut, Menu } from 'lucide-react';
import { useId, useState, type ElementType, type ReactNode } from 'react';
import { Avatar } from '../components/avatar.js';
import { Button } from '../components/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu.js';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../components/sheet.js';
import type { IconComponent } from '../icon.js';
import { cn } from '../lib/cn.js';
import { useThemePreference } from '../theme/ThemeProvider.js';
import type { ThemePreference } from '../theme/preference.js';
import { AppSwitcher, type SwitcherEntry } from './HeaderSwitcher.js';
import { LinkContext } from './link-context.js';
import { TenantryMark } from './TenantryMark.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: IconComponent;
  // A plain link that opens in a new tab (another site, such as the Keycloak console), not the router link.
  external?: boolean;
  // A full address in the other app (Tenantry or Admin): a normal link, not the router.
  crossApp?: boolean;
  // A group: a collapsed list titled `label`, open while one of its pages is current; its href is unused.
  children?: NavItem[];
  // A heading the item sits under ("Workspace"); items without one come first.
  section?: string;
}

export interface WorkspaceEntry {
  slug: string;
  name: string;
  href: string;
  current: boolean;
}

interface AppShellProps {
  // The workspace's name, shown at the top of the sidebar (or in the top bar on pages without one).
  productName: string;
  // Which app this is ("Tenantry" or "Admin"), shown under the workspace's name.
  appName?: string;
  navItems: NavItem[];
  currentPath: string;
  // The app's router link (it receives href); plain anchors, and full page loads, without it.
  linkAs?: ElementType;
  // The signed-in person, for the account menu; no menu without one.
  user?: { email: string; name?: string | undefined; onSignOut: () => void };
  // The running release, shown in the account menu (ADR-0030).
  version?: string | undefined;
  // The other apps of this workspace and the person's other workspaces; each switcher shows from two entries.
  apps?: SwitcherEntry[];
  workspaces?: WorkspaceEntry[];
  // The tenant's logo; without one, its first letter on its colour (in an app) or Tenantry's mark.
  logoUrl?: string | null;
  brandColor?: string | null;
  // Search and notifications, in the top bar.
  headerActions?: ReactNode;
  children: ReactNode;
}

const THEMES: { preference: ThemePreference; label: string }[] = [
  { preference: 'system', label: 'System' },
  { preference: 'light', label: 'Light' },
  { preference: 'dark', label: 'Dark' },
];

// Items in order, the ones without a section first, each section once under its heading.
function bySection(items: NavItem[]): { section: string | null; items: NavItem[] }[] {
  const groups: { section: string | null; items: NavItem[] }[] = [];
  for (const item of items) {
    const section = item.section ?? null;
    const group = groups.find((g) => g.section === section);
    if (group) group.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups.sort((a, b) => (a.section === null ? -1 : b.section === null ? 1 : 0));
}

const navRow = cn(
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors',
  'hover:bg-accent hover:text-foreground focus-ring',
  'aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground',
  '[&_svg]:size-4 [&_svg]:shrink-0',
);

interface NavContext {
  currentPath: string;
  linkAs: ElementType | undefined;
  onNavigate: (() => void) | undefined;
}

// One page: the router link for the app's own pages, a normal link to the other app, a new tab for another site.
function NavLink({ item, nav }: { item: NavItem; nav: NavContext }) {
  const current = !item.crossApp && !item.external && item.href === nav.currentPath;
  const Link: ElementType = nav.linkAs && !item.crossApp && !item.external ? nav.linkAs : 'a';
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={navRow}
      aria-current={current ? 'page' : undefined}
      onClick={nav.onNavigate}
      {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {Icon && <Icon aria-hidden="true" />}
      <span className="truncate">{item.label}</span>
      {item.external && <span className="sr-only"> (opens in a new tab)</span>}
      {(item.external || item.crossApp) && (
        <ArrowUpRight data-slot="leaves-app" aria-hidden="true" className="ml-auto text-muted-foreground" />
      )}
    </Link>
  );
}

function NavGroup({ item, nav }: { item: NavItem; nav: NavContext }) {
  const children = item.children ?? [];
  const [open, setOpen] = useState(() => children.some((child) => child.href === nav.currentPath));
  const Icon = item.icon;
  return (
    <>
      <button
        type="button"
        className={navRow}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {Icon && <Icon aria-hidden="true" />}
        <span className="truncate">{item.label}</span>
        <ChevronRight aria-hidden="true" className={cn('ml-auto transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <ul className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
          {children.map((child) => (
            <li key={child.href}>
              <NavLink item={child} nav={nav} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SideNav({ items, nav }: { items: NavItem[]; nav: NavContext }) {
  const id = useId();
  return (
    <nav aria-label="Side navigation" className="flex-1 overflow-y-auto px-3 py-2">
      {bySection(items).map(({ section, items: sectionItems }, index) => {
        const headingId = `${id}-section-${String(index)}`;
        return (
          <div key={section ?? 'top'} className={cn(section && 'mt-4')}>
            {section && (
              <p id={headingId} className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {section}
              </p>
            )}
            <ul aria-labelledby={section ? headingId : undefined} className="flex flex-col gap-0.5">
              {sectionItems.map((item) => (
                <li key={item.label}>
                  {item.children ? <NavGroup item={item} nav={nav} /> : <NavLink item={item} nav={nav} />}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

interface IdentityProps {
  productName: string;
  appName: string | undefined;
  logoUrl: string | null;
  brandColor: string | null;
}

// The workspace's logo, else its first letter on its colour inside an app, else Tenantry's own mark.
function IdentityMark({ productName, appName, logoUrl, brandColor }: IdentityProps) {
  if (logoUrl) return <img src={logoUrl} alt="" className="size-7 shrink-0 rounded-md object-contain" />;
  if (appName) {
    return (
      <span
        data-testid="workspace-badge"
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        style={brandColor ? { backgroundColor: brandColor } : undefined}
      >
        {productName.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return <TenantryMark />;
}

function Identity(props: IdentityProps) {
  return (
    <>
      <IdentityMark {...props} />
      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-sm font-semibold text-foreground" title={props.productName}>
          {props.productName}
        </span>
        {props.appName && <span className="truncate text-xs text-muted-foreground">{props.appName}</span>}
      </span>
    </>
  );
}

const identityRow =
  'flex min-w-0 items-center gap-2.5 rounded-md p-1.5 outline-none hover:bg-accent focus-ring';

// The top of the sidebar: the workspace, and the menu of the person's other workspaces when there are any.
function WorkspaceSwitcher({
  identity,
  workspaces,
  linkAs,
}: {
  identity: IdentityProps;
  workspaces: WorkspaceEntry[];
  linkAs: ElementType | undefined;
}) {
  if (workspaces.length < 2) {
    const Link: ElementType = linkAs ?? 'a';
    return (
      <Link href="/" className={identityRow}>
        <Identity {...identity} />
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Switch workspace" className={cn(identityRow, 'w-full')}>
        <Identity {...identity} />
        <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.slug} asChild>
            <a
              href={workspace.href}
              title={workspace.name}
              {...(workspace.current ? { 'aria-current': 'page' as const } : {})}
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-medium text-foreground"
              >
                {workspace.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.current && <Check aria-hidden="true" />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The person: who is signed in, the theme, Sign out, and the running version.
function AccountMenu({
  user,
  version,
  wide,
}: {
  user: NonNullable<AppShellProps['user']>;
  version: string | undefined;
  wide: boolean;
}) {
  const { preference, setPreference } = useThemePreference();
  const personName = user.name ?? user.email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className={cn(
          'flex items-center gap-2.5 rounded-md outline-none hover:bg-accent focus-ring',
          wide ? 'w-full p-1.5' : 'p-1',
        )}
      >
        <Avatar name={personName} size={wide ? 'md' : 'sm'} />
        {wide && (
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate text-sm font-medium text-foreground">{personName}</span>
            {user.name && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={wide ? 'start' : 'end'} side={wide ? 'top' : 'bottom'} className="w-60">
        <div className="flex flex-col px-2 py-1.5 text-sm">
          {user.name && <span className="truncate font-medium text-foreground">{user.name}</span>}
          <span className="truncate text-muted-foreground">{user.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            setPreference(value as ThemePreference);
          }}
        >
          {THEMES.map(({ preference: value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={user.onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
        {version && <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{`Tenantry ${version}`}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The frame every screen sits in: a sidebar (a drawer on phones) with the workspace, the pages and the account;
// a slim top bar with search, notifications and the app switcher; and the main landmark. The bar follows the
// page's light or dark theme.
export function AppShell({
  productName,
  appName,
  navItems,
  currentPath,
  linkAs,
  user,
  version,
  apps = [],
  workspaces = [],
  logoUrl = null,
  brandColor = null,
  headerActions,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasNav = navItems.length > 0;
  const identity: IdentityProps = { productName, appName, logoUrl, brandColor };

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <WorkspaceSwitcher identity={identity} workspaces={workspaces} linkAs={linkAs} />
      </div>
      <SideNav items={navItems} nav={{ currentPath, linkAs, onNavigate }} />
      {user && (
        <div className="border-t border-border p-3">
          <AccountMenu user={user} version={version} wide />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
      >
        Skip to main content
      </a>
      {/* No pages, no sidebar (welcome, signup, not found). */}
      {hasNav && (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-sidebar lg:block">
          {sidebar()}
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 sm:px-6">
          {hasNav ? (
            <>
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2 lg:hidden">
                    <Menu aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent aria-describedby={undefined}>
                  <SheetTitle>Menu</SheetTitle>
                  {sidebar(() => {
                    setDrawerOpen(false);
                  })}
                </SheetContent>
              </Sheet>
              <span className="truncate text-sm font-semibold lg:hidden">{productName}</span>
            </>
          ) : (
            <WorkspaceSwitcher identity={identity} workspaces={[]} linkAs={linkAs} />
          )}
          <div className="ml-auto flex items-center gap-1">
            {headerActions}
            <AppSwitcher entries={apps} />
            {!hasNav && user && <AccountMenu user={user} version={version} wide={false} />}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <LinkContext.Provider value={linkAs ?? null}>{children}</LinkContext.Provider>
        </main>
      </div>
    </div>
  );
}

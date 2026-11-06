import {
  Button,
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderPanel,
  RadioButton,
  RadioButtonGroup,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Theme,
} from '@carbon/react';
import { Enterprise, Switcher as SwitcherIcon, type CarbonIconType } from '@carbon/icons-react';
import { Fragment, useState, type ElementType, type ReactNode } from 'react';
import { initials } from '../patterns/Avatar.js';
// The header is always dark (g100), so its mark has light tiles.
import tenantryMark from '../../assets/brand/tenantry-mark-dark.svg';
import { useThemePreference } from '../theme/ThemeProvider.js';
import type { ThemePreference } from '../theme/preference.js';
import { HeaderSwitcherAction, HeaderSwitcherPanel, type SwitcherEntry } from './HeaderSwitcher.js';
import { LinkContext } from './link-context.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: CarbonIconType;
  // A plain link that opens in a new tab (another site, such as the Keycloak console), not the router link.
  external?: boolean;
  // A full address in the other app (Tenantry or Admin): a normal link, not the router.
  crossApp?: boolean;
  // A group: a collapsed menu titled `label`, open while one of its pages is current; its href is unused.
  children?: NavItem[];
  // A heading the item sits under ("Workspace"); items without one come first.
  section?: string;
}

// The link props for one item: the router link for the app's own pages, a normal link to the other app,
// a new tab for another site.
function navLinkProps(item: NavItem, currentPath: string, linkAs: ElementType | undefined) {
  const current = !item.crossApp && !item.external && item.href === currentPath;
  return {
    href: item.href,
    isActive: current,
    'aria-current': current ? ('page' as const) : undefined,
    ...(item.external
      ? { target: '_blank', rel: 'noreferrer' }
      : linkAs && !item.crossApp
        ? { as: linkAs }
        : {}),
  };
}

interface AppShellProps {
  // The workspace's name, shown in the header.
  productName: string;
  // Which app this is ("Tenantry" or "Admin"), shown after the workspace's name.
  appName?: string;
  navItems: NavItem[];
  currentPath: string;
  // The app's router link (it receives href); plain anchors, and full page loads, without it.
  linkAs?: ElementType;
  // The signed-in person, for the account menu; no menu without one.
  user?: { email: string; name?: string | undefined; onSignOut: () => void };
  // The other apps of this workspace and the person's other workspaces; each switcher shows from two entries.
  apps?: SwitcherEntry[];
  workspaces?: WorkspaceEntry[];
  // The tenant's logo, shown before the product name; without one, its first letter on its colour.
  logoUrl?: string | null;
  brandColor?: string | null;
  // Search and notifications, before the switchers.
  headerActions?: ReactNode;
  children: ReactNode;
}

export interface WorkspaceEntry {
  slug: string;
  name: string;
  href: string;
  current: boolean;
}

type Panel = 'account' | 'apps' | 'workspaces';

const THEMES: { preference: ThemePreference; label: string }[] = [
  { preference: 'light', label: 'Light' },
  { preference: 'dark', label: 'Dark' },
  { preference: 'system', label: 'System' },
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

function NavEntry({
  item,
  currentPath,
  linkAs,
}: {
  item: NavItem;
  currentPath: string;
  linkAs?: ElementType | undefined;
}) {
  if (item.children) {
    return (
      <SideNavMenu
        title={item.label}
        {...(item.icon ? { renderIcon: item.icon } : {})}
        defaultExpanded={item.children.some((child) => child.href === currentPath)}
      >
        {item.children.map((child) => (
          <SideNavMenuItem key={child.href} {...navLinkProps(child, currentPath, linkAs)}>
            {child.label}
          </SideNavMenuItem>
        ))}
      </SideNavMenu>
    );
  }
  return (
    <SideNavLink
      {...navLinkProps(item, currentPath, linkAs)}
      {...(item.icon ? { renderIcon: item.icon } : {})}
    >
      {item.label}
    </SideNavLink>
  );
}

// The frame every screen sits in: a header that is dark in both themes, a side nav, and the main landmark.
export function AppShell({
  productName,
  appName,
  navItems,
  currentPath,
  linkAs,
  user,
  apps = [],
  workspaces = [],
  logoUrl = null,
  brandColor = null,
  headerActions,
  children,
}: AppShellProps) {
  const { preference, setPreference } = useThemePreference();
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (panel: Panel) => {
    setOpen(open === panel ? null : panel);
  };
  const accountOpen = open === 'account';
  const workspaceEntries = workspaces.map(({ name, href, current }) => ({ label: name, href, current }));
  const hasNav = navItems.length > 0;
  const personName = user?.name ?? user?.email ?? '';
  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <>
          <Theme theme="g100">
            <Header aria-label={productName}>
              <SkipToContent />
              {/* No pages, no menu: an empty side nav would still open on wide screens. */}
              {hasNav && (
                <HeaderMenuButton
                  aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
                  isActive={isSideNavExpanded}
                  aria-expanded={isSideNavExpanded}
                  onClick={onClickSideNavExpand}
                />
              )}
              <HeaderName href="/" prefix="" {...(linkAs ? { as: linkAs } : {})}>
                {logoUrl ? (
                  <img className="tenantry-header__logo" src={logoUrl} alt="" />
                ) : appName ? (
                  <span
                    className="tenantry-header__badge"
                    data-testid="workspace-badge"
                    aria-hidden="true"
                    style={{ backgroundColor: brandColor ?? '#0f62fe' }}
                  >
                    {productName.trim().charAt(0).toUpperCase()}
                  </span>
                ) : (
                  // Outside a workspace (welcome, signup, not found): Tenantry's own mark.
                  <img className="tenantry-header__logo" src={tenantryMark} alt="" />
                )}
                <span className="tenantry-header__name">{productName}</span>
                {appName && <span className="tenantry-header__app">{appName}</span>}
              </HeaderName>
              <HeaderGlobalBar>
                {headerActions}
                <HeaderSwitcherAction
                  label="Switch workspace"
                  Icon={Enterprise}
                  entries={workspaceEntries}
                  open={open === 'workspaces'}
                  onToggle={() => {
                    toggle('workspaces');
                  }}
                />
                <HeaderSwitcherAction
                  label="Switch app"
                  Icon={SwitcherIcon}
                  entries={apps}
                  open={open === 'apps'}
                  onToggle={() => {
                    toggle('apps');
                  }}
                />
                {user && (
                  <HeaderGlobalAction
                    aria-label="Account"
                    aria-expanded={accountOpen}
                    isActive={accountOpen}
                    tooltipAlignment="end"
                    onClick={() => {
                      toggle('account');
                    }}
                  >
                    <span className="tenantry-avatar tenantry-avatar--sm tenantry-header__avatar">
                      {initials(personName)}
                    </span>
                  </HeaderGlobalAction>
                )}
              </HeaderGlobalBar>
              <HeaderSwitcherPanel
                label="Switch workspace"
                entries={workspaceEntries}
                open={open === 'workspaces'}
              />
              <HeaderSwitcherPanel label="Switch app" entries={apps} open={open === 'apps'} />
              {user && (
                <HeaderPanel aria-label="Account" expanded={accountOpen}>
                  <div className="tenantry-account">
                    <div className="tenantry-account__who">
                      <span className="tenantry-avatar tenantry-avatar--md">{initials(personName)}</span>
                      <div>
                        {user.name && <p className="tenantry-account__name">{user.name}</p>}
                        <p className="tenantry-account__email">{user.email}</p>
                      </div>
                    </div>
                    <RadioButtonGroup
                      legendText="Theme"
                      name="tenantry-theme"
                      orientation="vertical"
                      valueSelected={preference}
                      onChange={(value) => {
                        setPreference(value as ThemePreference);
                      }}
                    >
                      {THEMES.map(({ preference: value, label }) => (
                        <RadioButton key={value} id={`theme-${value}`} labelText={label} value={value} />
                      ))}
                    </RadioButtonGroup>
                    <Button kind="secondary" size="sm" onClick={user.onSignOut}>
                      Sign out
                    </Button>
                  </div>
                </HeaderPanel>
              )}
            </Header>
          </Theme>
          {hasNav && (
            <SideNav
              aria-label="Side navigation"
              expanded={isSideNavExpanded}
              onSideNavBlur={onClickSideNavExpand}
              href="/"
            >
              <SideNavItems>
                {bySection(navItems).map(({ section, items }) => (
                  <Fragment key={section ?? 'top'}>
                    {section && (
                      <>
                        <SideNavDivider />
                        <li className="tenantry-nav__section">{section}</li>
                      </>
                    )}
                    {items.map((item) => (
                      <NavEntry key={item.label} item={item} currentPath={currentPath} linkAs={linkAs} />
                    ))}
                  </Fragment>
                ))}
              </SideNavItems>
            </SideNav>
          )}
          <Content id="main-content">
            <LinkContext.Provider value={linkAs ?? null}>{children}</LinkContext.Provider>
          </Content>
        </>
      )}
    />
  );
}

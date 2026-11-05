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
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Theme,
} from '@carbon/react';
import {
  Asleep,
  Enterprise,
  Light,
  Screen,
  Switcher as SwitcherIcon,
  UserAvatar,
  type CarbonIconType,
} from '@carbon/icons-react';
import { useState, type ElementType, type ReactNode } from 'react';
import tenantryMark from '../../assets/brand/tenantry-mark.svg';
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
  // A group: a collapsed menu titled `label`, open while one of its pages is current; its href is unused.
  children?: NavItem[];
}

// The link props for one item: the router link for the app's own pages, a new tab for another site.
function navLinkProps(item: NavItem, currentPath: string, linkAs: ElementType | undefined) {
  const current = item.href === currentPath;
  return {
    href: item.href,
    isActive: current,
    'aria-current': current ? ('page' as const) : undefined,
    ...(item.external ? { target: '_blank', rel: 'noreferrer' } : linkAs ? { as: linkAs } : {}),
  };
}

interface AppShellProps {
  productName: string;
  navItems: NavItem[];
  currentPath: string;
  // The app's router link (it receives href); plain anchors, and full page loads, without it.
  linkAs?: ElementType;
  // The signed-in person, for the account menu; no menu without one.
  user?: { email: string; onSignOut: () => void };
  // The other apps of this workspace and the person's other workspaces; each switcher shows from two entries.
  apps?: SwitcherEntry[];
  workspaces?: WorkspaceEntry[];
  // The tenant's logo, shown before the product name.
  logoUrl?: string | null;
  children: ReactNode;
}

export interface WorkspaceEntry {
  slug: string;
  name: string;
  href: string;
  current: boolean;
}

type Panel = 'account' | 'apps' | 'workspaces';

const THEME_ACTIONS: { preference: ThemePreference; label: string; Icon: CarbonIconType }[] = [
  { preference: 'light', label: 'Light theme', Icon: Light },
  { preference: 'dark', label: 'Dark theme', Icon: Asleep },
  { preference: 'system', label: 'Use system theme', Icon: Screen },
];

// The frame every screen sits in: a header that is dark in both themes, a side nav, and the main landmark.
export function AppShell({
  productName,
  navItems,
  currentPath,
  linkAs,
  user,
  apps = [],
  workspaces = [],
  logoUrl = null,
  children,
}: AppShellProps) {
  const { preference, setPreference } = useThemePreference();
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (panel: Panel) => {
    setOpen(open === panel ? null : panel);
  };
  const accountOpen = open === 'account';
  const workspaceEntries = workspaces.map(({ name, href, current }) => ({ label: name, href, current }));
  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <>
          <Theme theme="g100">
            <Header aria-label={productName}>
              <SkipToContent />
              <HeaderMenuButton
                aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
                isActive={isSideNavExpanded}
                aria-expanded={isSideNavExpanded}
                onClick={onClickSideNavExpand}
              />
              <HeaderName href="/" prefix="" {...(linkAs ? { as: linkAs } : {})}>
                <img className="tenantry-header__logo" src={logoUrl ?? tenantryMark} alt="" />
                {productName}
              </HeaderName>
              <HeaderGlobalBar>
                {THEME_ACTIONS.map(({ preference: value, label, Icon }) => (
                  <HeaderGlobalAction
                    key={value}
                    aria-label={label}
                    isActive={preference === value}
                    onClick={() => {
                      setPreference(value);
                    }}
                  >
                    <Icon size={20} />
                  </HeaderGlobalAction>
                ))}
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
                    <UserAvatar size={20} />
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
                    <p className="tenantry-account__email">{user.email}</p>
                    <Button kind="secondary" size="sm" onClick={user.onSignOut}>
                      Sign out
                    </Button>
                  </div>
                </HeaderPanel>
              )}
            </Header>
          </Theme>
          <SideNav
            aria-label="Side navigation"
            expanded={isSideNavExpanded}
            onSideNavBlur={onClickSideNavExpand}
            href="/"
          >
            <SideNavItems>
              {navItems.map((item) =>
                item.children ? (
                  <SideNavMenu
                    key={item.label}
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
                ) : (
                  <SideNavLink
                    key={item.href}
                    {...navLinkProps(item, currentPath, linkAs)}
                    {...(item.icon ? { renderIcon: item.icon } : {})}
                  >
                    {item.label}
                  </SideNavLink>
                ),
              )}
            </SideNavItems>
          </SideNav>
          <Content id="main-content">
            <LinkContext.Provider value={linkAs ?? null}>{children}</LinkContext.Provider>
          </Content>
        </>
      )}
    />
  );
}

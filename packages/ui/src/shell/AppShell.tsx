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
  SkipToContent,
  Theme,
} from '@carbon/react';
import { Asleep, Light, Screen, UserAvatar, type CarbonIconType } from '@carbon/icons-react';
import { useState, type ElementType, type ReactNode } from 'react';
import { useThemePreference } from '../theme/ThemeProvider.js';
import type { ThemePreference } from '../theme/preference.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: CarbonIconType;
}

interface AppShellProps {
  productName: string;
  navItems: NavItem[];
  currentPath: string;
  // The app's router link (it receives href); plain anchors, and full page loads, without it.
  linkAs?: ElementType;
  // The signed-in person, for the account menu; no menu without one.
  user?: { email: string; onSignOut: () => void };
  children: ReactNode;
}

const THEME_ACTIONS: { preference: ThemePreference; label: string; Icon: CarbonIconType }[] = [
  { preference: 'light', label: 'Light theme', Icon: Light },
  { preference: 'dark', label: 'Dark theme', Icon: Asleep },
  { preference: 'system', label: 'Use system theme', Icon: Screen },
];

// The frame every screen sits in: a header that is dark in both themes, a side nav, and the main landmark.
export function AppShell({ productName, navItems, currentPath, linkAs, user, children }: AppShellProps) {
  const { preference, setPreference } = useThemePreference();
  const [accountOpen, setAccountOpen] = useState(false);
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
              <HeaderName href="/" prefix="">
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
                {user && (
                  <HeaderGlobalAction
                    aria-label="Account"
                    aria-expanded={accountOpen}
                    isActive={accountOpen}
                    tooltipAlignment="end"
                    onClick={() => {
                      setAccountOpen(!accountOpen);
                    }}
                  >
                    <UserAvatar size={20} />
                  </HeaderGlobalAction>
                )}
              </HeaderGlobalBar>
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
              {navItems.map((item) => {
                const current = item.href === currentPath;
                return (
                  <SideNavLink
                    key={item.href}
                    {...(linkAs ? { as: linkAs } : {})}
                    href={item.href}
                    {...(item.icon ? { renderIcon: item.icon } : {})}
                    isActive={current}
                    aria-current={current ? 'page' : undefined}
                  >
                    {item.label}
                  </SideNavLink>
                );
              })}
            </SideNavItems>
          </SideNav>
          <Content id="main-content">{children}</Content>
        </>
      )}
    />
  );
}

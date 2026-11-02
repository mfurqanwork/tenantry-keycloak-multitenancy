import {
  Content,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from '@carbon/react';
import { Asleep, Light, Screen, type CarbonIconType } from '@carbon/icons-react';
import type { ReactNode } from 'react';
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
  children: ReactNode;
}

const THEME_ACTIONS: { preference: ThemePreference; label: string; Icon: CarbonIconType }[] = [
  { preference: 'light', label: 'Light theme', Icon: Light },
  { preference: 'dark', label: 'Dark theme', Icon: Asleep },
  { preference: 'system', label: 'Use system theme', Icon: Screen },
];

// The frame every screen sits in: a header that is dark in both themes, a side nav, and the main landmark.
export function AppShell({ productName, navItems, currentPath, children }: AppShellProps) {
  const { preference, setPreference } = useThemePreference();
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
              </HeaderGlobalBar>
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

import {
  Application,
  ColorPalette,
  DataShare,
  Folder,
  Home,
  Launch,
  RecentlyViewed,
  Security,
  Settings,
  UserMultiple,
  type CarbonIconType,
} from '@carbon/icons-react';
import type { Permission } from '@tenantry/auth';
import type { NavItem } from '@tenantry/ui';
import type { Workspace } from './workspaces.js';

export type App = 'web' | 'portal';

// What the menu needs to know about the signed-in person.
export interface MenuPerson {
  tenant: { tier: 'standard' | 'enterprise' };
  can: (permission: Permission) => boolean;
  consoleUrl?: string;
}

interface Page {
  label: string;
  path: string;
  app: App;
  icon: CarbonIconType;
  shown: (me: MenuPerson) => boolean;
}

const can = (permission: Permission) => (me: MenuPerson) => me.can(permission);

// One menu for Tenantry and Admin (spec 8.1, ADR-0027). The API checks every call again; this only
// decides what is shown.
const TOP: Page[] = [
  { label: 'Home', path: '/', app: 'web', icon: Home, shown: () => true },
  { label: 'Projects', path: '/projects', app: 'web', icon: Folder, shown: can('projects:read') },
];
const WORKSPACE: Page[] = [
  { label: 'People', path: '/people', app: 'portal', icon: UserMultiple, shown: can('members:invite') },
  { label: 'Branding', path: '/branding', app: 'portal', icon: ColorPalette, shown: can('tenant:settings') },
  {
    label: 'Sign-in & security',
    path: '/security',
    app: 'portal',
    icon: Security,
    shown: can('tenant:settings'),
  },
  { label: 'Audit log', path: '/audit', app: 'portal', icon: RecentlyViewed, shown: can('audit:read') },
];
const ADVANCED: Page[] = [
  {
    label: 'Directory sync (SCIM)',
    path: '/advanced/scim',
    app: 'portal',
    icon: DataShare,
    shown: can('tenant:settings'),
  },
  {
    label: 'Customer apps',
    path: '/advanced/apps',
    app: 'portal',
    icon: Application,
    shown: (me) => me.tenant.tier === 'enterprise' && me.can('apps:register'),
  },
];

// The menu as seen from one app: its own pages by path (the router), the other app's by full address.
export function workspaceMenu(me: MenuPerson, workspaces: Workspace[], app: App): NavItem[] {
  const here = workspaces.find((w) => w.current);
  const item = (page: Page, section?: string): NavItem | null => {
    if (!page.shown(me)) return null;
    const base = page.app === app ? null : page.app === 'web' ? here?.webUrl : here?.portalUrl;
    if (page.app !== app && !base) return null;
    return {
      label: page.label,
      href: base ? new URL(page.path, base).toString() : page.path,
      icon: page.icon,
      ...(base ? { crossApp: true } : {}),
      ...(section ? { section } : {}),
    };
  };
  const present = (x: NavItem | null): x is NavItem => x !== null;
  const advanced = ADVANCED.map((p) => item(p)).filter(present);
  if (me.consoleUrl) {
    advanced.push({ label: 'Keycloak console', href: me.consoleUrl, icon: Launch, external: true });
  }
  return [
    ...TOP.map((p) => item(p)).filter(present),
    ...WORKSPACE.map((p) => item(p, 'Workspace')).filter(present),
    ...(advanced.length > 0
      ? [{ label: 'Advanced', href: '#advanced', icon: Settings, section: 'Workspace', children: advanced }]
      : []),
  ];
}

import { ROLE_PERMISSIONS, type Permission } from '@tenantry/auth';
import { Folder, Home, Launch, UserMultiple } from '@carbon/icons-react';
import { describe, expect, it } from 'vitest';
import { workspaceMenu, type MenuPerson } from './menu.js';
import type { Workspace } from './workspaces.js';

const WS: Workspace[] = [
  {
    slug: 'acme',
    name: 'Acme',
    current: true,
    webUrl: 'http://acme.tenantry.localhost/',
    portalUrl: 'http://acme.portal.tenantry.localhost/',
  },
];

const person = (
  role: keyof typeof ROLE_PERMISSIONS,
  tier: 'standard' | 'enterprise' = 'enterprise',
  consoleUrl?: string,
): MenuPerson => ({
  tenant: { tier },
  can: (p: Permission) => ROLE_PERMISSIONS[role].includes(p),
  ...(consoleUrl ? { consoleUrl } : {}),
});

const labels = (items: ReturnType<typeof workspaceMenu>) =>
  items.map((i) => (i.children ? `${i.label}[${i.children.map((c) => c.label).join(',')}]` : i.label));

describe('workspaceMenu (spec 8.1)', () => {
  it('gives an Enterprise owner every page, in order, each with its icon', () => {
    const menu = workspaceMenu(
      person('owner', 'enterprise', 'http://auth.test/admin/ent-acme/console/'),
      WS,
      'web',
    );
    expect(labels(menu)).toEqual([
      'Home',
      'Projects',
      'People',
      'Branding',
      'Sign-in & security',
      'Audit log',
      'Advanced[Directory sync (SCIM),Customer apps,Keycloak console]',
    ]);
    expect(menu.find((i) => i.label === 'Home')?.icon).toBe(Home);
    expect(menu.find((i) => i.label === 'Projects')?.icon).toBe(Folder);
    expect(menu.find((i) => i.label === 'People')?.icon).toBe(UserMultiple);
    expect(menu.find((i) => i.label === 'People')?.section).toBe('Workspace');
    const console = menu.find((i) => i.children)?.children?.find((c) => c.label === 'Keycloak console');
    expect(console).toMatchObject({ external: true, icon: Launch });
  });

  it("links pages in the other app by their full address, and this app's by path", () => {
    const fromWeb = workspaceMenu(person('owner'), WS, 'web');
    expect(fromWeb.find((i) => i.label === 'Home')).toMatchObject({ href: '/' });
    expect(fromWeb.find((i) => i.label === 'People')).toMatchObject({
      href: 'http://acme.portal.tenantry.localhost/people',
      crossApp: true,
    });
    const fromAdmin = workspaceMenu(person('owner'), WS, 'portal');
    expect(fromAdmin.find((i) => i.label === 'Home')).toMatchObject({
      href: 'http://acme.tenantry.localhost/',
      crossApp: true,
    });
    expect(fromAdmin.find((i) => i.label === 'People')).toMatchObject({ href: '/people' });
  });

  it('gives an admin of a Standard workspace People and the Audit log, and no Advanced', () => {
    expect(labels(workspaceMenu(person('admin', 'standard'), WS, 'web'))).toEqual([
      'Home',
      'Projects',
      'People',
      'Audit log',
    ]);
  });

  it('gives a member Home and Projects only', () => {
    expect(labels(workspaceMenu(person('member'), WS, 'portal'))).toEqual(['Home', 'Projects']);
  });

  it("leaves out the other app's pages until the workspaces have loaded", () => {
    expect(labels(workspaceMenu(person('owner'), [], 'web'))).toEqual(['Home', 'Projects']);
  });
});

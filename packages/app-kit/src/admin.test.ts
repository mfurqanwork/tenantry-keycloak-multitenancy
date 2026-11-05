import { ROLE_PERMISSIONS, type Permission } from '@tenantry/auth';
import { describe, expect, it } from 'vitest';
import { adminUrl, canSeeAdmin } from './admin.js';
import { appLinks, type Workspace } from './workspaces.js';

const holding = (role: keyof typeof ROLE_PERMISSIONS) => (p: Permission) =>
  ROLE_PERMISSIONS[role].includes(p);

const acme: Workspace = {
  slug: 'acme',
  name: 'Acme',
  current: true,
  webUrl: 'http://acme.tenantry.localhost/',
  portalUrl: 'http://acme.portal.tenantry.localhost/',
};

describe('Admin (ADR-0027)', () => {
  it('is for owners and admins, never members', () => {
    expect(canSeeAdmin(holding('member'))).toBe(false);
    expect(canSeeAdmin(holding('admin'))).toBe(true);
    expect(canSeeAdmin(holding('owner'))).toBe(true);
  });

  it('names the two apps Tenantry and Admin', () => {
    expect(appLinks([acme], 'web', { admin: true }).map((l) => l.label)).toEqual(['Tenantry', 'Admin']);
  });

  it('shows no app switcher to someone who may not see Admin', () => {
    expect(appLinks([acme], 'web', { admin: false })).toEqual([]);
  });

  it('builds Admin addresses for the current workspace', () => {
    expect(adminUrl([acme], '/people?invite=1')).toBe(
      'http://acme.portal.tenantry.localhost/people?invite=1',
    );
    expect(adminUrl([{ ...acme, current: false }], '/people')).toBeNull();
  });
});

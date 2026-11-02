import { describe, expect, it } from 'vitest';
import {
  canAssignRole,
  highestRole,
  permissionsFor,
  ROLE_PERMISSIONS,
  roleForGroupPath,
  groupForRole,
} from './roles.js';

describe('permissionsFor', () => {
  it('gives the owner every permission', () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(10);
    expect(permissionsFor(['owner'])).toEqual(new Set(ROLE_PERMISSIONS.owner));
  });

  it('keeps tenant settings from admins', () => {
    expect(permissionsFor(['admin']).has('tenant:settings')).toBe(false);
  });

  it('lets members read and work on projects, nothing more', () => {
    expect([...permissionsFor(['member'])].sort()).toEqual([
      'apps:read',
      'members:read',
      'projects:read',
      'projects:write',
    ]);
  });

  it('unions the permissions of several roles', () => {
    expect(permissionsFor(['member', 'admin']).has('members:invite')).toBe(true);
  });

  it('grants nothing without roles', () => {
    expect(permissionsFor([]).size).toBe(0);
  });
});

describe('groups and roles', () => {
  it('maps organization group paths to roles', () => {
    expect(roleForGroupPath('/admins')).toBe('admin');
    expect(roleForGroupPath('owners')).toBe('owner');
    expect(roleForGroupPath('/admins/x')).toBeNull();
    expect(roleForGroupPath('/other')).toBeNull();
  });

  it('maps roles back to groups', () => {
    expect(groupForRole('member')).toBe('members');
  });

  it('picks the highest role', () => {
    expect(highestRole(['member', 'owner'])).toBe('owner');
    expect(highestRole(['member', 'admin'])).toBe('admin');
    expect(highestRole([])).toBeNull();
  });
});

describe('canAssignRole', () => {
  it('lets admins move people between admin and member', () => {
    expect(canAssignRole('admin', 'member', 'admin')).toBe(true);
    expect(canAssignRole('admin', null, 'member')).toBe(true);
  });

  it('keeps owner changes for owners', () => {
    expect(canAssignRole('admin', 'member', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'owner', 'member')).toBe(false);
    expect(canAssignRole('owner', 'admin', 'owner')).toBe(true);
  });

  it('never lets a member assign roles', () => {
    expect(canAssignRole('member', 'member', 'member')).toBe(false);
  });
});

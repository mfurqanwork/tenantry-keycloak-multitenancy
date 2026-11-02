import { describe, expect, it } from 'vitest';
import { permissionsFor, ROLE_PERMISSIONS } from './roles.js';

describe('permissionsFor', () => {
  it('gives the owner every permission', () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(8);
    expect(permissionsFor(['owner'])).toEqual(new Set(ROLE_PERMISSIONS.owner));
  });

  it('keeps tenant settings from admins', () => {
    expect(permissionsFor(['admin']).has('tenant:settings')).toBe(false);
  });

  it('lets members only read', () => {
    expect([...permissionsFor(['member'])].sort()).toEqual(['apps:read', 'members:read']);
  });

  it('unions the permissions of several roles', () => {
    expect(permissionsFor(['member', 'admin']).has('members:invite')).toBe(true);
  });

  it('grants nothing without roles', () => {
    expect(permissionsFor([]).size).toBe(0);
  });
});

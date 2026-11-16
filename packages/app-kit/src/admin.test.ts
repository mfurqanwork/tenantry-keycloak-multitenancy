import { ROLE_PERMISSIONS, type Permission } from '@tenantry/auth';
import { describe, expect, it } from 'vitest';
import { canSeeAdmin } from './admin.js';

const holding = (role: keyof typeof ROLE_PERMISSIONS) => (p: Permission) =>
  ROLE_PERMISSIONS[role].includes(p);

describe('Admin (ADR-0027)', () => {
  it('is for owners and admins, never members', () => {
    expect(canSeeAdmin(holding('member'))).toBe(false);
    expect(canSeeAdmin(holding('admin'))).toBe(true);
    expect(canSeeAdmin(holding('owner'))).toBe(true);
  });
});

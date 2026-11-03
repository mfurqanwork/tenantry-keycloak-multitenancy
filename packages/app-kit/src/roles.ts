import type { Role } from '@tenantry/auth';

export const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

// What the signed-in person may hand out; the API applies the same rule (canAssignRole).
export function assignableRoles(myRole: Role | null): Role[] {
  if (myRole === 'owner') return ['member', 'admin', 'owner'];
  if (myRole === 'admin') return ['member', 'admin'];
  return [];
}

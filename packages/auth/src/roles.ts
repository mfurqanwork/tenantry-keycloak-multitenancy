// ADR-0008: code checks permissions, never roles. This map is the only place roles gain meaning.
export type Role = 'owner' | 'admin' | 'member';

export type Permission =
  | 'members:read'
  | 'members:invite'
  | 'members:remove'
  | 'members:change-role'
  | 'apps:read'
  | 'apps:register'
  | 'tenant:settings'
  | 'audit:read';

const ADMIN: readonly Permission[] = [
  'members:read',
  'members:invite',
  'members:remove',
  'members:change-role',
  'apps:read',
  'apps:register',
  'audit:read',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: [...ADMIN, 'tenant:settings'],
  admin: ADMIN,
  member: ['members:read', 'apps:read'],
};

export function permissionsFor(roles: readonly Role[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}

// ADR-0008: code checks permissions, never roles. This map is the only place roles gain meaning.
export type Role = 'owner' | 'admin' | 'member';

// Each Standard tenant is a Keycloak organization with one group per role.
export type GroupName = 'owners' | 'admins' | 'members';

export type Permission =
  | 'members:read'
  | 'members:invite'
  | 'members:remove'
  | 'members:change-role'
  | 'apps:read'
  | 'apps:register'
  | 'tenant:settings'
  | 'audit:read'
  | 'projects:read'
  | 'projects:write';

// Highest first.
export const ROLES: readonly Role[] = ['owner', 'admin', 'member'];

const MEMBER: readonly Permission[] = ['members:read', 'apps:read', 'projects:read', 'projects:write'];

const ADMIN: readonly Permission[] = [
  ...MEMBER,
  'members:invite',
  'members:remove',
  'members:change-role',
  'apps:register',
  'audit:read',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: [...ADMIN, 'tenant:settings'],
  admin: ADMIN,
  member: MEMBER,
};

export function permissionsFor(roles: readonly Role[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}

const GROUP_FOR_ROLE: Readonly<Record<Role, GroupName>> = {
  owner: 'owners',
  admin: 'admins',
  member: 'members',
};

export function groupForRole(role: Role): GroupName {
  return GROUP_FOR_ROLE[role];
}

// Accepts the token's group path ("/admins") or a bare name; nested or unknown groups grant nothing.
export function roleForGroupPath(path: string): Role | null {
  const name = path.startsWith('/') ? path.slice(1) : path;
  return ROLES.find((role) => GROUP_FOR_ROLE[role] === name) ?? null;
}

export function highestRole(roles: readonly Role[]): Role | null {
  return ROLES.find((role) => roles.includes(role)) ?? null;
}

// Only an owner may make or unmake an owner; admins move people between admin and member.
export function canAssignRole(actor: Role, from: Role | null, to: Role): boolean {
  if (actor === 'owner') return true;
  if (actor !== 'admin') return false;
  return from !== 'owner' && to !== 'owner';
}

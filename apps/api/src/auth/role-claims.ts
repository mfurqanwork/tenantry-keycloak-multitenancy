import { roleForGroupPath, ROLES, type Role } from '@tenantry/auth';

export type Membership = { member: false } | { member: true; roles: Role[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// AGENTS.md rule 2: roles come only from organization.<alias>.groups, never from realm_access.
export function rolesFromClaims(payload: Record<string, unknown>, alias: string): Membership {
  const orgs = payload['organization'];
  if (!isRecord(orgs)) return { member: false };
  const block = orgs[alias];
  if (!isRecord(block)) return { member: false };
  const groups = Array.isArray(block['groups']) ? block['groups'] : [];
  const roles = groups
    .filter((g): g is string => typeof g === 'string')
    .map(roleForGroupPath)
    .filter((r): r is Role => r !== null);
  return { member: true, roles };
}

// AGENTS.md rule 2, Enterprise: roles come only from our API client's roles in the tenant's own realm
// (ADR-0004), never from realm_access or another client. A token with none of our roles is no member.
export function rolesFromClientRoles(
  payload: Record<string, unknown>,
  clientId = 'tenantry-api',
): Membership {
  const access = payload['resource_access'];
  if (!isRecord(access)) return { member: false };
  const block = access[clientId];
  if (!isRecord(block) || !Array.isArray(block['roles'])) return { member: false };
  const roles = block['roles'].filter(
    (r): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r),
  );
  return roles.length ? { member: true, roles } : { member: false };
}

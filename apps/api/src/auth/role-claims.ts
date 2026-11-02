import { roleForGroupPath, type Role } from '@tenantry/auth';

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

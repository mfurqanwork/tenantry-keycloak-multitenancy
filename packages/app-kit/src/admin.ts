import type { Permission } from '@tenantry/auth';
import type { Workspace } from './workspaces.js';

// Admin is for owners and admins (ADR-0027). A member reads the member list through the API, but no Admin
// page is theirs: People needs members:invite, the settings tenant:settings, the audit log audit:read.
export function canSeeAdmin(can: (permission: Permission) => boolean): boolean {
  return can('members:invite') || can('tenant:settings') || can('audit:read');
}

// An address in this workspace's Admin, for links and redirects from Tenantry; null until the workspaces load.
export function adminUrl(workspaces: Workspace[], path: string): string | null {
  const here = workspaces.find((w) => w.current);
  return here ? new URL(path, here.portalUrl).toString() : null;
}

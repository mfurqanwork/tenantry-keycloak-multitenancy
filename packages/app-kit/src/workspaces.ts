import { useResource } from './useResource.js';

export interface Workspace {
  slug: string;
  name: string;
  current: boolean;
  webUrl: string;
  portalUrl: string;
}

// Every workspace the signed-in person belongs to; empty until loaded or if the call fails.
export function useWorkspaces(): Workspace[] {
  return useResource<Workspace[]>('/api/me/workspaces').data ?? [];
}

// The header's app switcher for this workspace: Tenantry and its Admin. Someone who may not see Admin gets
// none, since a switcher shows from two entries (ADR-0027).
export function appLinks(workspaces: Workspace[], current: 'web' | 'portal', options: { admin: boolean }) {
  const here = workspaces.find((w) => w.current);
  if (!here || !options.admin) return [];
  return [
    { label: 'Tenantry', href: here.webUrl, current: current === 'web' },
    { label: 'Admin', href: here.portalUrl, current: current === 'portal' },
  ];
}

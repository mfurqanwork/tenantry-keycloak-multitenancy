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

// The header's app switcher for this workspace: the web app and the portal.
export function appLinks(workspaces: Workspace[], current: 'web' | 'portal') {
  const here = workspaces.find((w) => w.current);
  if (!here) return [];
  return [
    { label: 'Tenantry', href: here.webUrl, current: current === 'web' },
    { label: 'Tenantry Portal', href: here.portalUrl, current: current === 'portal' },
  ];
}

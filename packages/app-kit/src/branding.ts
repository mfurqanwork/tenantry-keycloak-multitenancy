import { brandTokens } from '@tenantry/brand';
import { applyBrand } from '@tenantry/ui';
import { useEffect } from 'react';
import { useResource } from './useResource.js';

export interface Branding {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
}

// The workspace's public branding; while mounted, its colour drives Carbon's interactive tokens.
// reload() fetches it again, after the branding page saved a change.
export function useBranding(slug: string): { branding: Branding | null; reload: () => void } {
  const { data, reload } = useResource<Branding>(`/api/tenants/${encodeURIComponent(slug)}/branding`);
  const color = data?.primaryColor ?? null;
  useEffect(() => {
    if (!color) return;
    applyBrand(brandTokens(color));
    return () => {
      applyBrand(null);
    };
  }, [color]);
  return { branding: data ?? null, reload };
}

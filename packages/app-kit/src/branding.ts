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
export function useBranding(slug: string): Branding | null {
  const { data } = useResource<Branding>(`/api/tenants/${encodeURIComponent(slug)}/branding`);
  const color = data?.primaryColor ?? null;
  useEffect(() => {
    if (!color) return;
    applyBrand(brandTokens(color));
    return () => {
      applyBrand(null);
    };
  }, [color]);
  return data ?? null;
}

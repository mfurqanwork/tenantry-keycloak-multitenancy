export const BASE_DOMAIN: string =
  (import.meta.env['VITE_TENANTRY_BASE_DOMAIN'] as string | undefined) ?? 'tenantry.localhost';

// The same rule as the API's: <slug>.portal.<base domain> is the portal of tenant <slug>.
export function portalSlugFromHost(hostname: string, baseDomain: string): string | null {
  const name = hostname.toLowerCase().replace(/\.$/, '');
  const suffix = `.portal.${baseDomain.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const label = name.slice(0, -suffix.length);
  return /^[a-z0-9-]+$/.test(label) ? label : null;
}

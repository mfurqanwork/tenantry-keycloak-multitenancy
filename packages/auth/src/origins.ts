import type { TenantApp } from './context.js';

// What a tenant address is built from: the public auth URL (for its scheme), the base domain, the port.
export interface OriginSettings {
  authUrl: string;
  baseDomain: string;
  publicPort: number | null;
}

// A tenant app's browser origin: the public auth URL's scheme, <slug>[.portal].<base domain>, same port.
export function tenantOrigin(slug: string, config: OriginSettings, app: TenantApp = 'web'): string {
  const scheme = new URL(config.authUrl).protocol;
  const port = config.publicPort === null ? '' : `:${String(config.publicPort)}`;
  const host = app === 'portal' ? `${slug}.portal.${config.baseDomain}` : `${slug}.${config.baseDomain}`;
  return `${scheme}//${host}${port}`;
}

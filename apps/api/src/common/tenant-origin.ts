import type { TenantApp } from '@tenantry/auth';
import type { AppConfig } from '../config/config.js';

// A tenant app's browser origin: the public auth URL's scheme, <slug>[.portal].<base domain>, same port.
export function tenantOrigin(
  slug: string,
  config: Pick<AppConfig, 'authUrl' | 'baseDomain' | 'publicPort'>,
  app: TenantApp = 'web',
): string {
  const scheme = new URL(config.authUrl).protocol;
  const port = config.publicPort === null ? '' : `:${String(config.publicPort)}`;
  const host = app === 'portal' ? `${slug}.portal.${config.baseDomain}` : `${slug}.${config.baseDomain}`;
  return `${scheme}//${host}${port}`;
}

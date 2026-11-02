import type { AppConfig } from '../../config/config.js';

const FORMAT = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
// Hostnames the platform itself uses, or that would read as ours.
const RESERVED = new Set(['www', 'auth', 'mail', 'api', 'portal', 'app', 'admin', 'tenantry']);

export type SlugCheck = { ok: true } | { ok: false; reason: 'format' | 'reserved' };

export function validateSlug(slug: string): SlugCheck {
  if (!FORMAT.test(slug)) return { ok: false, reason: 'format' };
  if (RESERVED.has(slug)) return { ok: false, reason: 'reserved' };
  return { ok: true };
}

// The tenant's browser origin: same scheme as the public auth URL, <slug>.<base domain>, same port.
export function tenantOrigin(
  slug: string,
  config: Pick<AppConfig, 'authUrl' | 'baseDomain' | 'publicPort'>,
): string {
  const scheme = new URL(config.authUrl).protocol;
  const port = config.publicPort === null ? '' : `:${String(config.publicPort)}`;
  return `${scheme}//${slug}.${config.baseDomain}${port}`;
}

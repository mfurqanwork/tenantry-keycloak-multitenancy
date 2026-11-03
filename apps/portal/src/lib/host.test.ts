import { describe, expect, it } from 'vitest';
import { portalSlugFromHost } from './host.js';

const base = 'tenantry.localhost';

describe('portalSlugFromHost', () => {
  it('reads the tenant in front of portal.<base domain>', () => {
    expect(portalSlugFromHost('acme.portal.tenantry.localhost', base)).toBe('acme');
    expect(portalSlugFromHost('ACME.portal.tenantry.localhost.', base)).toBe('acme');
  });

  it('has no tenant on the bare portal host, the web host or anything else', () => {
    expect(portalSlugFromHost('portal.tenantry.localhost', base)).toBeNull();
    expect(portalSlugFromHost('acme.tenantry.localhost', base)).toBeNull();
    expect(portalSlugFromHost('a.b.portal.tenantry.localhost', base)).toBeNull();
    expect(portalSlugFromHost('acme.portal.evil.localhost', base)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { slugFromHost, tenantFromHost } from './host.js';

const base = 'tenantry.localhost';

describe('slugFromHost', () => {
  it('reads the tenant label and drops the port', () => {
    expect(slugFromHost('acme.tenantry.localhost:8080', base)).toBe('acme');
  });

  it('ignores case and one trailing dot', () => {
    expect(slugFromHost('ACME.tenantry.localhost.', base)).toBe('acme');
    expect(slugFromHost('Acme.tenantry.localhost.:8080', base)).toBe('acme');
  });

  it('rejects nested labels, other domains and lookalikes', () => {
    expect(slugFromHost('a.b.tenantry.localhost', base)).toBeNull();
    expect(slugFromHost('evil.com', base)).toBeNull();
    expect(slugFromHost('acme.eviltenantry.localhost', base)).toBeNull();
    expect(slugFromHost('acme.tenantry.localhost.evil.com', base)).toBeNull();
  });
});

describe('tenantFromHost', () => {
  it('reads the portal host as the same tenant', () => {
    expect(tenantFromHost('acme.portal.tenantry.localhost:8080', base)).toEqual({
      slug: 'acme',
      app: 'portal',
    });
    expect(slugFromHost('ACME.portal.tenantry.localhost.', base)).toBe('acme');
  });
});

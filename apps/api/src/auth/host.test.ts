import { describe, expect, it } from 'vitest';
import { slugFromHost } from './host.js';

const base = 'tenantry.localhost';

describe('slugFromHost', () => {
  it('reads the tenant label and drops the port', () => {
    expect(slugFromHost('acme.tenantry.localhost:8080', base)).toBe('acme');
  });

  it('ignores case and one trailing dot', () => {
    expect(slugFromHost('ACME.tenantry.localhost.', base)).toBe('acme');
    expect(slugFromHost('Acme.tenantry.localhost.:8080', base)).toBe('acme');
  });

  it('has no tenant on the apex host', () => {
    expect(slugFromHost('tenantry.localhost', base)).toBeNull();
    expect(slugFromHost('tenantry.localhost:8080', base)).toBeNull();
  });

  it('rejects nested labels, other domains and lookalikes', () => {
    expect(slugFromHost('a.b.tenantry.localhost', base)).toBeNull();
    expect(slugFromHost('evil.com', base)).toBeNull();
    expect(slugFromHost('acme.eviltenantry.localhost', base)).toBeNull();
    expect(slugFromHost('acme.tenantry.localhost.evil.com', base)).toBeNull();
  });

  it('has no tenant without a host', () => {
    expect(slugFromHost(undefined, base)).toBeNull();
    expect(slugFromHost('', base)).toBeNull();
  });
});

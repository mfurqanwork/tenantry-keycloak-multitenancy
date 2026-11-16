import { describe, expect, it } from 'vitest';
import { EMPTY_ZONE, upsertTxt } from './zone-file.js';

const serial = (zone: string) => Number(/SOA \S+ \S+ (\d+)/.exec(zone)?.[1]);

describe('upsertTxt', () => {
  it('adds a TXT record under the zone and raises the serial', () => {
    const zone = upsertTxt(EMPTY_ZONE, '_tenantry-verify.acme.test', 'tenantry-verify=abc');
    expect(zone).toContain('_tenantry-verify.acme.test. 60 IN TXT "tenantry-verify=abc"');
    expect(serial(zone)).toBeGreaterThan(serial(EMPTY_ZONE));
  });

  it('refuses a name outside the .test zone and quotes in the value', () => {
    expect(() => upsertTxt(EMPTY_ZONE, 'acme.com', 'v')).toThrow(/\.test/);
    expect(() => upsertTxt(EMPTY_ZONE, 'x.test', 'a"b')).toThrow(/quote/);
  });
});

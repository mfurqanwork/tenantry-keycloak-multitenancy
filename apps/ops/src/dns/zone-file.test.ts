import { describe, expect, it } from 'vitest';
import { EMPTY_ZONE, upsertTxt } from './zone-file.js';

const serial = (zone: string) => Number(/SOA \S+ \S+ (\d+)/.exec(zone)?.[1]);

describe('upsertTxt', () => {
  it('adds a TXT record under the zone and raises the serial', () => {
    const zone = upsertTxt(EMPTY_ZONE, '_tenantry-verify.acme.test', 'tenantry-verify=abc');
    expect(zone).toContain('_tenantry-verify.acme.test. 60 IN TXT "tenantry-verify=abc"');
    expect(serial(zone)).toBeGreaterThan(serial(EMPTY_ZONE));
  });

  it('replaces the value for the same name', () => {
    const once = upsertTxt(EMPTY_ZONE, '_tenantry-verify.acme.test', 'tenantry-verify=old');
    const twice = upsertTxt(once, '_tenantry-verify.acme.test', 'tenantry-verify=new');
    expect(twice).not.toContain('tenantry-verify=old');
    expect(twice.match(/IN TXT/g)).toHaveLength(1);
    expect(serial(twice)).toBeGreaterThan(serial(once));
  });

  it('starts from an empty zone when there is none yet', () => {
    expect(upsertTxt('', 'x.test', 'v')).toContain('IN SOA');
  });

  it('refuses a name outside the .test zone and quotes in the value', () => {
    expect(() => upsertTxt(EMPTY_ZONE, 'acme.com', 'v')).toThrow(/\.test/);
    expect(() => upsertTxt(EMPTY_ZONE, 'x.test', 'a"b')).toThrow(/quote/);
  });
});

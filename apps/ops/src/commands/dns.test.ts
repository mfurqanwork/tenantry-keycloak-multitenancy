import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { setTxt } from './dns.js';

const dir = mkdtempSync(join(tmpdir(), 'tenantry-dns-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('ops dns set-txt', () => {
  it('writes the record into the zone file, creating it when missing', () => {
    const zone = join(dir, 'test.db');
    const out: string[] = [];
    let reloaded = 0;
    const reload = () => {
      reloaded++;
    };
    expect(
      setTxt(zone, '_tenantry-verify.acme.test', 'tenantry-verify=abc', (l) => out.push(l), reload),
    ).toBe(0);
    // CoreDNS does not see file changes through a Windows bind mount, so it is told to reload.
    expect(reloaded).toBe(1);
    expect(readFileSync(zone, 'utf8')).toContain(
      '_tenantry-verify.acme.test. 60 IN TXT "tenantry-verify=abc"',
    );
    expect(out.join('\n')).toMatch(/_tenantry-verify\.acme\.test/);
  });
});

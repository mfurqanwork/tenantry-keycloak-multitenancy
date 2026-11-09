import { describe, expect, it } from 'vitest';
import { memoryDns } from './memory-dns.js';

describe('memoryDns', () => {
  it('answers with the record it was given', async () => {
    const dns = memoryDns();
    dns.setTxt('_tenantry.acme.test', 'token');
    await expect(dns.resolveTxt('_tenantry.acme.test')).resolves.toEqual(['token']);
  });

  it('answers nothing for a name it does not know', async () => {
    await expect(memoryDns().resolveTxt('other.test')).resolves.toEqual([]);
  });
});

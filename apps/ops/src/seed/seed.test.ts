import { describe, expect, it } from 'vitest';
import type { ApiCall } from './http.js';
import { COMPANY, ensureProjects, WORKSPACES } from './seed.js';

describe('the demo seed', () => {
  it('the demo workspace is Pengopal, in the Pengopal blue', () => {
    expect(WORKSPACES[0]).toEqual({
      slug: 'pengopal',
      name: 'Pengopal',
      color: '#2b77c0',
      owner: 'ada@example.test',
    });
    expect(COMPANY.tenant).toBe('pengopal');
  });
});

describe('the demo projects', () => {
  it('adds only the projects a workspace does not have, so a second run changes nothing', async () => {
    const existing = [{ name: 'Website relaunch' }];
    const created: unknown[] = [];
    const api = ((_host: string, method: string, _path: string, o?: { body?: unknown }) => {
      if (method === 'GET') return Promise.resolve({ status: 200, body: { projects: existing } });
      created.push(o?.body);
      return Promise.resolve({ status: 201, body: {} });
    }) as unknown as ApiCall;
    const added = await ensureProjects(api, 'pengopal.tenantry.localhost', 'token', [
      'Website relaunch',
      'Mobile app',
    ]);
    expect(created).toEqual([{ name: 'Mobile app' }]);
    expect(added).toBe(1);
  });
});

import { listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface Project {
  id: string;
  name: string;
}

let t: TestApp;
let acme: TestTenant;
let globex: TestTenant;

beforeAll(async () => {
  t = await createTestApp();
  acme = await t.seedTenant();
  globex = await t.seedTenant();
});
afterAll(() => t.close());

describe('projects', () => {
  it('lets a member create a project and audits it', async () => {
    const { token } = await t.member(acme, 'members');
    const res = await t.request<Project>({
      host: acme.host,
      method: 'POST',
      path: '/api/projects',
      token,
      body: { name: '  Apollo  ' },
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Apollo');
    const audit = await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 10 }));
    expect(audit).toContainEqual(expect.objectContaining({ action: 'project.created', target: res.body.id }));
    const list = await t.request<{ projects: Project[] }>({ host: acme.host, path: '/api/projects', token });
    expect(list.body.projects.map((p) => p.id)).toContain(res.body.id);
  });

  it("keeps one tenant's projects out of another's", async () => {
    const { token: acmeToken } = await t.member(acme, 'members');
    const created = await t.request<Project>({
      host: acme.host,
      method: 'POST',
      path: '/api/projects',
      token: acmeToken,
      body: { name: 'Acme secret' },
    });
    const { token: globexToken } = await t.member(globex, 'members');
    const list = await t.request<{ projects: Project[] }>({
      host: globex.host,
      path: '/api/projects',
      token: globexToken,
    });
    expect(list.body.projects.map((p) => p.id)).not.toContain(created.body.id);
    const byId = await t.request({
      host: globex.host,
      path: `/api/projects/${created.body.id}`,
      token: globexToken,
    });
    expect(byId.status).toBe(404);
    const own = await t.request<Project>({
      host: acme.host,
      path: `/api/projects/${created.body.id}`,
      token: acmeToken,
    });
    expect(own.body.name).toBe('Acme secret');
  });

  it('refuses an empty or overlong name, and a malformed id', async () => {
    const { token } = await t.member(acme, 'members');
    const post = (name: string) =>
      t.request({ host: acme.host, method: 'POST', path: '/api/projects', token, body: { name } });
    expect((await post('   ')).status).toBe(422);
    expect((await post('x'.repeat(121))).status).toBe(422);
    expect((await post('x'.repeat(120))).status).toBe(201);
    expect((await t.request({ host: acme.host, path: '/api/projects/not-a-uuid', token })).status).toBe(404);
  });
});

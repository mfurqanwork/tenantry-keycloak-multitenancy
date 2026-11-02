import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface AuditPage {
  entries: { id: string; action: string; actor: { id: string | null; email: string | null } }[];
  nextBefore: string | null;
}

let t: TestApp;
let acme: TestTenant;

beforeAll(async () => {
  t = await createTestApp();
  acme = await t.seedTenant();
});
afterAll(() => t.close());

describe('GET /api/audit', () => {
  it('is closed to members', async () => {
    const { token } = await t.member(acme, 'members');
    expect((await t.request({ host: acme.host, path: '/api/audit', token })).status).toBe(403);
  });

  it('shows admins the newest entries first, with actor emails, and pages', async () => {
    const { user, token } = await t.member(acme, 'admins');
    for (const name of ['First', 'Second']) {
      await t.request({ host: acme.host, method: 'POST', path: '/api/projects', token, body: { name } });
    }
    const page = await t.request<AuditPage>({ host: acme.host, path: '/api/audit', token });
    expect(page.status).toBe(200);
    expect(page.body.entries[0]?.action).toBe('project.created');
    expect(page.body.entries[0]?.actor.email).toBe(user.email);
    expect(page.body.nextBefore).toBeNull();

    const [newest, older] = page.body.entries;
    const next = await t.request<AuditPage>({
      host: acme.host,
      path: `/api/audit?before=${newest?.id ?? ''}`,
      token,
    });
    expect(next.body.entries[0]?.id).toBe(older?.id);
  });

  it('refuses a malformed cursor', async () => {
    const { token } = await t.member(acme, 'admins');
    expect((await t.request({ host: acme.host, path: '/api/audit?before=nope', token })).status).toBe(422);
  });
});

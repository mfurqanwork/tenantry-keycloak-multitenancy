import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface AuditPage {
  entries: {
    id: string;
    action: string;
    targetLabel: string | null;
    actor: { id: string | null; email: string | null };
  }[];
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

  it('names each target: the email for members and invites, the name for projects', async () => {
    const tenant = await t.seedTenant();
    const owner = await t.member(tenant, 'owners');
    const member = await t.member(tenant, 'members');
    const as = (path: string, method = 'GET', body?: unknown) =>
      t.request<AuditPage>({ host: tenant.host, method, path, token: owner.token, body });
    await as('/api/projects', 'POST', { name: 'Apollo' });
    await as('/api/members/invites', 'POST', { email: 'new@example.com', role: 'member' });
    const members = await t.request<{ members: { userId: string; email: string }[] }>({
      host: tenant.host,
      path: '/api/members',
      token: owner.token,
    });
    const memberId = members.body.members.find((m) => m.email === member.user.email)?.userId ?? '';
    await as(`/api/members/${memberId}`, 'PATCH', { role: 'admin' });
    const { entries } = (await as('/api/audit')).body;
    const label = (action: string) => entries.find((e) => e.action === action)?.targetLabel;
    expect(label('project.created')).toBe('Apollo');
    expect(label('member.invited')).toBe('new@example.com');
    expect(label('member.role_changed')).toBe(member.user.email);
  });
});

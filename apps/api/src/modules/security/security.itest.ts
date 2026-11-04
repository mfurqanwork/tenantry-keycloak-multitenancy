import { SECURITY_DEFAULTS, type SecuritySettings } from '@tenantry/auth';
import { getSecurity, listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

type Ent = TestTenant & { issuer: string; realm: string };

let t: TestApp;
let ent: Ent;
let owner: string;

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

const put = (body: unknown, as = owner, host = ent.host) =>
  t.request<SecuritySettings & { detail?: string }>({
    host,
    method: 'PUT',
    path: '/api/security',
    token: as,
    body,
  });
const custom: SecuritySettings = {
  ...SECURITY_DEFAULTS,
  twoStep: 'required',
  passwordMinLength: 16,
  passwordHistory: 5,
  sessionIdleMinutes: 20,
};

beforeEach(async () => {
  t = await appPromise;
  t.provisioner.clearFailures();
  ent = await t.seedEnterpriseTenant();
  owner = await t.enterpriseToken(ent, t.newUser(), ['owner']);
  await t.provisioner.ensureRealm(ent.realm);
});

describe('security settings', () => {
  it('starts from the defaults', async () => {
    const res = await t.request<SecuritySettings>({ host: ent.host, path: '/api/security', token: owner });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(SECURITY_DEFAULTS);
  });

  it('saves, applies to the realm, and audits before and after', async () => {
    const res = await put(custom);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(custom);
    const realm = t.provisioner.realms.get(ent.realm);
    expect(realm?.twoStep).toBe('required');
    expect(realm?.settings['passwordPolicy']).toBe(
      'length(16) and notUsername and notEmail and passwordHistory(5)',
    );
    expect(await tenantTx(t.db, ent.id, (tx) => getSecurity(tx))).toEqual(custom);
    const audit = await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 5 }));
    expect(audit.find((e) => e.action === 'security.updated')?.metadata).toMatchObject({
      before: SECURITY_DEFAULTS,
      after: custom,
    });
  });

  it('keeps the row as it was when Keycloak refuses', async () => {
    await put(custom);
    t.provisioner.failOn('applySecurity', 400);
    const res = await put({ ...custom, passwordMinLength: 20 });
    expect(res.status).toBe(422);
    expect(res.body.detail).toContain('injected failure');
    expect(await tenantTx(t.db, ent.id, (tx) => getSecurity(tx))).toEqual(custom);
  });

  it('refuses an idle time longer than the session may last, applying nothing', async () => {
    const res = await put({ ...SECURITY_DEFAULTS, sessionIdleMinutes: 720, sessionMaxHours: 1 });
    expect(res.status).toBe(422);
    expect(res.body.detail).toContain(
      'sessionIdleMinutes: A session cannot sit idle longer than it may last.',
    );
    expect(t.provisioner.realms.get(ent.realm)?.twoStep ?? null).toBeNull();
  });

  it('is for owners of enterprise workspaces only', async () => {
    const admin = await t.enterpriseToken(ent, t.newUser(), ['admin']);
    expect((await put(custom, admin)).status).toBe(403);
    const standard = await t.seedTenant();
    const { token } = await t.member(standard, 'owners');
    const res = await t.request<{ detail: string }>({ host: standard.host, path: '/api/security', token });
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('Security settings and SCIM are available on Enterprise workspaces.');
  });

  it("does not report a tenant's own settings as drift, but does report a change by hand", async () => {
    const operator = await t.operatorToken();
    const upgrade = (dryRun: boolean) =>
      t.request<{ differences: { path: string }[] }[]>({
        host: t.apexHost,
        method: 'POST',
        path: '/api/platform/enterprise-tenants/upgrade',
        token: operator,
        body: { slug: ent.slug, dryRun },
      });
    await upgrade(false);
    expect((await put(custom)).status).toBe(200);
    expect((await upgrade(true)).body[0]?.differences).toEqual([]);
    t.provisioner.setTwoStepByHand(ent.realm, 'off');
    expect((await upgrade(true)).body[0]?.differences.map((d) => d.path)).toContain(
      'secondStep.Browser - Conditional 2FA',
    );
    await upgrade(false);
    expect(t.provisioner.realms.get(ent.realm)?.twoStep).toBe('required');
  });
});

import { listApps, listAudit, tenantApps, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface AppView {
  id: string;
  clientId: string;
  name: string;
  type: string;
  redirectUris: string[];
  connection: Record<string, string | null>;
}
interface Registered {
  app: AppView;
  clientSecret?: string;
}

type Ent = TestTenant & { issuer: string; realm: string };

let t: TestApp;
let ent: Ent;
let owner: string;

const appPromise = createTestApp({ config: { maxAppsPerTenant: 3 } });
afterAll(async () => (await appPromise).close());

const token = (tenant: Ent, role: 'owner' | 'admin' | 'member') =>
  t.enterpriseToken(tenant, t.newUser(), [role]);
const post = (body: unknown, as = owner, host = ent.host) =>
  t.request<Registered>({ host, method: 'POST', path: '/api/apps', token: as, body });
const web = { name: 'HR portal', type: 'web', redirectUris: ['https://hr.initech.test/callback'] };

beforeEach(async () => {
  t = await appPromise;
  ent = await t.seedEnterpriseTenant();
  owner = await token(ent, 'owner');
});

describe('registering a customer app', () => {
  it('returns the secret once and keeps it nowhere', async () => {
    const res = await post(web);
    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toEqual(expect.any(String));
    expect(res.body.app.clientId).toMatch(/^app-[0-9a-f]{8}$/);
    const [row] = await tenantTx(t.db, ent.id, (tx) => tx.select().from(tenantApps));
    expect(Object.keys(row ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(row ?? {}).some((c) => /secret/i.test(c))).toBe(false);
    expect(JSON.stringify(row)).not.toContain(res.body.clientSecret ?? '-');
    const again = await t.request<AppView>({
      host: ent.host,
      path: `/api/apps/${res.body.app.id}`,
      token: owner,
    });
    expect(again.status).toBe(200);
    expect(JSON.stringify(again.body)).not.toContain(res.body.clientSecret ?? '-');
    const audit = await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 10 }));
    const entry = audit.find((e) => e.action === 'app.registered');
    expect(entry?.metadata).toMatchObject({ name: 'HR portal', clientId: res.body.app.clientId });
    expect(JSON.stringify(audit)).not.toContain(res.body.clientSecret ?? '-');
  });

  it("adds the portal's test sign-in to Keycloak, not to the app's own list", async () => {
    const res = await post(web);
    const testRedirect = `http://${ent.slug}.portal.tenantry.localhost/applications/test-callback`;
    expect(res.body.app.redirectUris).toEqual(['https://hr.initech.test/callback']);
    expect(res.body.app.connection['testRedirectUri']).toBe(testRedirect);
    const client = [...t.realmApps(ent.realm).clients.values()].find(
      (c) => c.clientId === res.body.app.clientId,
    );
    expect(client?.spec.redirectUris).toEqual(['https://hr.initech.test/callback', testRedirect]);
  });

  it('gives a public app no secret, and shows the connection details', async () => {
    const res = await post({ ...web, type: 'spa' });
    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeUndefined();
    expect(res.body.app.connection).toMatchObject({
      issuer: ent.issuer,
      discoveryUrl: `${ent.issuer}/.well-known/openid-configuration`,
      authorizationEndpoint: `${ent.issuer}/protocol/openid-connect/auth`,
      tokenEndpoint: `${ent.issuer}/protocol/openid-connect/token`,
      jwksUri: `${ent.issuer}/protocol/openid-connect/certs`,
      endSessionEndpoint: `${ent.issuer}/protocol/openid-connect/logout`,
      clientId: res.body.app.clientId,
      scopes: 'openid profile email',
    });
  });

  it('lists apps newest first, for every role', async () => {
    const first = await post(web);
    const second = await post({ ...web, name: 'Second', type: 'm2m', redirectUris: [] });
    expect(second.body.app.connection['testRedirectUri']).toBeNull();
    const list = await t.request<{ apps: AppView[] }>({
      host: ent.host,
      path: '/api/apps',
      token: await token(ent, 'member'),
    });
    expect(list.status).toBe(200);
    expect(list.body.apps.map((a) => a.id)).toEqual([second.body.app.id, first.body.app.id]);
  });

  it('refuses members', async () => {
    expect((await post(web, await token(ent, 'member'))).status).toBe(403);
  });

  it('is for enterprise workspaces only', async () => {
    const standard = await t.seedTenant();
    const { token: std } = await t.member(standard, 'owners');
    const res = await t.request<{ detail: string }>({ host: standard.host, path: '/api/apps', token: std });
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('Applications are available on Enterprise workspaces.');
  });

  it("hides another workspace's app", async () => {
    const mine = await post(web);
    const other = await t.seedEnterpriseTenant();
    const res = await t.request({
      host: other.host,
      path: `/api/apps/${mine.body.app.id}`,
      token: await token(other, 'owner'),
    });
    expect(res.status).toBe(404);
    expect((await t.request({ host: ent.host, path: '/api/apps/nope', token: owner })).status).toBe(404);
  });

  it('refuses a bad URI with its field and position', async () => {
    const res = await post({ ...web, redirectUris: ['http://hr.initech.test/cb'] });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toContain(
      'redirectUris.0: Use https (http only for 127.0.0.1 or [::1]).',
    );
  });

  it('keycloak refusal leaves no row', async () => {
    t.realmApps(ent.realm).failNext(400, 'Invalid Redirect Uri: invalid uri');
    const res = await post(web);
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toContain('Invalid Redirect Uri: invalid uri');
    expect(await tenantTx(t.db, ent.id, (tx) => listApps(tx))).toEqual([]);
  });

  it('stops at the cap', async () => {
    for (let i = 0; i < 3; i++) expect((await post({ ...web, name: `App ${String(i)}` })).status).toBe(201);
    const res = await post(web);
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('This workspace has the most apps allowed (3).');
  });

  it('the cap holds under concurrent registrations', async () => {
    for (let i = 0; i < 2; i++) await post({ ...web, name: `App ${String(i)}` });
    const results = await Promise.all([post(web), post(web)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await tenantTx(t.db, ent.id, (tx) => listApps(tx))).toHaveLength(3);
  });
});

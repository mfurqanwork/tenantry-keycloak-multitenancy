import { listApps, listAudit, tenantApps, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface AppView {
  id: string;
  clientId: string;
  name: string;
  type: string;
  redirectUris: string[];
  webOrigins: string[];
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

  it("lets the portal's test sign-in call Keycloak from the browser (web origins)", async () => {
    const portal = `http://${ent.slug}.portal.tenantry.localhost`;
    const specOf = (clientId: string) =>
      [...t.realmApps(ent.realm).clients.values()].find((c) => c.clientId === clientId)?.spec;
    const spa = await post({ ...web, type: 'spa', webOrigins: ['https://hr.initech.test'] });
    expect(specOf(spa.body.app.clientId)?.webOrigins).toEqual(['https://hr.initech.test', portal]);
    expect(spa.body.app.webOrigins).toEqual(['https://hr.initech.test']);
    const native = await post({ name: 'Mobile', type: 'native', redirectUris: ['com.initech.hr:/cb'] });
    expect(specOf(native.body.app.clientId)?.webOrigins).toEqual([portal]);
    const plainSpa = await post({ ...web, type: 'spa' });
    expect(specOf(plainSpa.body.app.clientId)?.webOrigins).toEqual([]);
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

describe('changing a customer app', () => {
  const call = <T = unknown>(method: string, path: string, body?: unknown, as = owner) =>
    t.request<T>({ host: ent.host, method, path, token: as, ...(body === undefined ? {} : { body }) });
  const actions = async () =>
    (await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 50 }))).map((e) => e.action);
  const kcClient = (clientId: string) =>
    [...t.realmApps(ent.realm).clients.entries()].find(([, c]) => c.clientId === clientId);

  it('edits the name and URIs in our record and in Keycloak, keeping the test sign-in', async () => {
    const { app } = (await post(web)).body;
    const res = await call<AppView>('PATCH', `/api/apps/${app.id}`, {
      name: 'HR',
      redirectUris: ['https://hr2.initech.test/cb'],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'HR',
      type: 'web',
      redirectUris: ['https://hr2.initech.test/cb'],
    });
    expect(kcClient(app.clientId)?.[1].spec.redirectUris).toEqual([
      'https://hr2.initech.test/cb',
      app.connection['testRedirectUri'],
    ]);
    expect(await actions()).toContain('app.updated');
    const bad = await call('PATCH', `/api/apps/${app.id}`, {
      name: 'HR',
      redirectUris: ['http://x.test/cb'],
    });
    expect(bad.status).toBe(422);
  });

  it('rotates a secret: the old one stops working', async () => {
    const { app } = (await post({ name: 'Sync', type: 'm2m' })).body;
    const first = (await post({ name: 'Sync 2', type: 'm2m' })).body;
    const res = await call<{ clientSecret: string }>('POST', `/api/apps/${first.app.id}/secret`);
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).not.toBe(first.clientSecret);
    const apps = t.realmApps(ent.realm);
    expect((await apps.checkClientCredentials(first.app.clientId, first.clientSecret ?? '')).ok).toBe(false);
    expect((await apps.checkClientCredentials(first.app.clientId, res.body.clientSecret)).ok).toBe(true);
    const audit = await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 50 }));
    expect(audit.map((e) => e.action)).toContain('app.secret_rotated');
    expect(JSON.stringify(audit)).not.toContain(res.body.clientSecret);
    expect(app.type).toBe('m2m');
  });

  it('has no secret to rotate for a public app', async () => {
    const { app } = (await post({ ...web, type: 'spa' })).body;
    const res = await call<{ detail: string }>('POST', `/api/apps/${app.id}/secret`);
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe('This app has no secret (public client).');
  });

  it('checks a machine-to-machine token, without keeping the secret', async () => {
    const { app, clientSecret } = (await post({ name: 'Sync', type: 'm2m' })).body;
    const ok = await call<{ ok: boolean }>('POST', `/api/apps/${app.id}/token-check`, { clientSecret });
    expect(ok.body).toEqual({ ok: true });
    const wrong = await call<{ ok: boolean; error?: string }>('POST', `/api/apps/${app.id}/token-check`, {
      clientSecret: 'wrong',
    });
    expect(wrong.body.ok).toBe(false);
    expect(wrong.body.error).toEqual(expect.any(String));
    const audit = await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 50 }));
    const checks = audit.filter((e) => e.action === 'app.token_checked').map((e) => e.metadata['ok']);
    expect(checks.sort()).toEqual([false, true]);
    expect(JSON.stringify(audit)).not.toContain(clientSecret ?? '-');
    const webApp = (await post(web)).body.app;
    const notM2m = await call<{ detail: string }>('POST', `/api/apps/${webApp.id}/token-check`, {
      clientSecret: 'x',
    });
    expect(notM2m.status).toBe(409);
    expect(notM2m.body.detail).toBe('Token checks are for machine-to-machine apps.');
  });

  it('deletes an app and its client, also when the client is already gone', async () => {
    const { app } = (await post(web)).body;
    expect((await call('DELETE', `/api/apps/${app.id}`)).status).toBe(204);
    expect(kcClient(app.clientId)).toBeUndefined();
    expect((await call('GET', `/api/apps/${app.id}`)).status).toBe(404);
    expect(await actions()).toContain('app.deleted');
    const gone = (await post(web)).body.app;
    t.realmApps(ent.realm).forget(kcClient(gone.clientId)?.[0] ?? '');
    expect((await call('DELETE', `/api/apps/${gone.id}`)).status).toBe(204);
    expect((await call('DELETE', `/api/apps/${gone.id}`)).status).toBe(404);
  });

  it('missing client: edit and rotate say so', async () => {
    const { app } = (await post(web)).body;
    t.realmApps(ent.realm).forget(kcClient(app.clientId)?.[0] ?? '');
    const message = "This app's client no longer exists in Keycloak. Delete the app.";
    const edit = await call<{ detail: string }>('PATCH', `/api/apps/${app.id}`, {
      name: 'HR',
      redirectUris: ['https://hr.initech.test/cb'],
    });
    expect(edit.status).toBe(409);
    expect(edit.body.detail).toBe(message);
    const rotate = await call<{ detail: string }>('POST', `/api/apps/${app.id}/secret`);
    expect(rotate.status).toBe(409);
    expect(rotate.body.detail).toBe(message);
  });

  it('refuses members', async () => {
    const { app } = (await post({ name: 'Sync', type: 'm2m' })).body;
    const member = await token(ent, 'member');
    expect((await call('PATCH', `/api/apps/${app.id}`, { name: 'x' }, member)).status).toBe(403);
    expect((await call('POST', `/api/apps/${app.id}/secret`, undefined, member)).status).toBe(403);
    expect(
      (await call('POST', `/api/apps/${app.id}/token-check`, { clientSecret: 'x' }, member)).status,
    ).toBe(403);
    expect((await call('DELETE', `/api/apps/${app.id}`, undefined, member)).status).toBe(403);
  });
});

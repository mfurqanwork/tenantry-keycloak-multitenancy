import { listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

type Ent = TestTenant & { issuer: string; realm: string };
interface ScimError {
  schemas: string[];
  status: string;
  detail: string;
}

let t: TestApp;
let ent: Ent;
let owner: string;
let token: string;

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

const ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';
const scim = <T = unknown>(o: {
  method?: string;
  path: string;
  body?: unknown;
  as?: string | null;
  host?: string;
  raw?: Buffer;
}) =>
  t.request<T>({
    host: o.host ?? ent.host,
    method: o.method ?? 'GET',
    path: `/scim/v2/${o.path}`,
    ...(o.raw ? { raw: o.raw, headers: { 'content-type': 'application/scim+json' } } : {}),
    ...(o.body === undefined ? {} : { body: o.body }),
    ...(o.as === null ? {} : { token: o.as ?? token }),
  });
const newToken = async (tenant: Ent, as: string, days = 90) =>
  (
    await t.request<{ token: string }>({
      host: tenant.host,
      method: 'POST',
      path: '/api/scim/token',
      token: as,
      body: { expiresInDays: days },
    })
  ).body.token;
const audit = () => tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 20 }));
const createUser = (userName = `u-${String(Date.now())}@corp.test`) =>
  scim<{ id: string }>({
    method: 'POST',
    path: 'Users',
    body: { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName, active: true },
  });

beforeEach(async () => {
  t = await appPromise;
  ent = await t.seedEnterpriseTenant();
  owner = await t.enterpriseToken(ent, t.newUser(), ['owner']);
  token = await newToken(ent, owner);
});

describe('SCIM gateway: who may call', () => {
  it('answers 401 with a SCIM body for no token, a wrong one, or another scheme', async () => {
    for (const res of [
      await scim<ScimError>({ path: 'Users', as: null }),
      await scim<ScimError>({ path: 'Users', as: 'tnt_scim_nottherealone' }),
      await t.request<ScimError>({
        host: ent.host,
        path: '/scim/v2/Users',
        headers: { authorization: `Basic ${token}` },
      }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.schemas).toEqual([ERROR]);
      expect(res.body.status).toBe('401');
    }
  });

  it('scheme is case-insensitive', async () => {
    const res = await t.request({
      host: ent.host,
      path: '/scim/v2/Users',
      headers: { authorization: `bearer   ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('refuses a revoked token', async () => {
    await t.request({ host: ent.host, method: 'DELETE', path: '/api/scim/token', token: owner });
    expect((await scim({ path: 'Users' })).status).toBe(401);
  });

  it('refuses an expired token', async () => {
    await t.expireScimTokens(ent.id);
    expect((await scim({ path: 'Users' })).status).toBe(401);
  });

  it("refuses workspace A's token on workspace B", async () => {
    const other = await t.seedEnterpriseTenant();
    await newToken(other, await t.enterpriseToken(other, t.newUser(), ['owner']));
    const res = await scim<ScimError>({ path: 'Users', host: other.host });
    expect(res.status).toBe(401);
    expect(t.realmScim(other.realm).calls).toHaveLength(0);
  });

  it('is not on Standard workspaces', async () => {
    const standard = await t.seedTenant();
    const res = await scim<ScimError>({ path: 'Users', host: standard.host });
    expect(res.status).toBe(404);
    expect(res.body.schemas).toEqual([ERROR]);
  });

  it("takes no person's token on /scim, and no SCIM token on /api", async () => {
    expect((await scim({ path: 'Users', as: owner })).status).toBe(401);
    expect((await t.request({ host: ent.host, path: '/api/me', token })).status).toBe(401);
  });
});

describe('SCIM gateway: what it passes on', () => {
  it('query passes through encoded', async () => {
    const query = 'filter=userName%20eq%20%22a%2Bb%40corp.test%22&startIndex=1';
    await t.request({ host: ent.host, path: `/scim/v2/Users?${query}`, token });
    expect(t.realmScim(ent.realm).calls.at(-1)).toMatchObject({ method: 'GET', path: 'Users', query });
  });

  it('creates a person, rewrites Location, grants the default role and audits it', async () => {
    const res = await createUser();
    expect(res.status).toBe(201);
    expect(res.headers['location']).toBe(`http://${ent.host}/scim/v2/Users/${res.body.id}`);
    expect(t.realmScim(ent.realm).people.get(res.body.id)?.role).toBe('member');
    const entry = (await audit()).find((e) => e.action === 'scim.user_created');
    expect(entry).toMatchObject({ target: res.body.id, actorUserId: null, metadata: { via: 'scim' } });
  });

  it('grants nothing when the default role is none', async () => {
    await t.request({
      host: ent.host,
      method: 'PUT',
      path: '/api/scim/default-role',
      token: owner,
      body: { role: 'none' },
    });
    const res = await createUser();
    expect(t.realmScim(ent.realm).people.get(res.body.id)?.role).toBeNull();
  });

  it('entra-style deactivate: no grant, audited as a deactivation', async () => {
    const { body } = await createUser();
    const fake = t.realmScim(ent.realm);
    const person = fake.people.get(body.id);
    if (person) person.role = null;
    const res = await scim({
      method: 'PATCH',
      path: `Users/${body.id}`,
      body: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
      },
    });
    expect(res.status).toBe(200);
    expect(fake.people.get(body.id)).toMatchObject({ active: false, role: null });
    expect((await audit()).some((e) => e.action === 'scim.user_deactivated' && e.target === body.id)).toBe(
      true,
    );
  });

  it('empties a mapped group instead of deleting it', async () => {
    const fake = t.realmScim(ent.realm);
    const admins = fake.groupNamed('tenantry-admins');
    fake.groups.get(admins)?.members.add('someone');
    const res = await scim({ method: 'DELETE', path: `Groups/${admins}` });
    expect(res.status).toBe(204);
    expect(fake.groups.get(admins)?.members.size).toBe(0);
    expect(fake.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect((await audit()).some((e) => e.action === 'scim.group_changed')).toBe(true);
  });

  it('forwards the delete of any other group', async () => {
    const fake = t.realmScim(ent.realm);
    fake.groups.set('g-other', { name: 'engineering', members: new Set() });
    expect((await scim({ method: 'DELETE', path: 'Groups/g-other' })).status).toBe(204);
    expect(fake.groups.has('g-other')).toBe(false);
  });

  it('refuses a body over 1 MB', async () => {
    const res = await scim<ScimError>({
      method: 'POST',
      path: 'Users',
      raw: Buffer.alloc(1024 * 1024 + 10, 'a'),
    });
    expect(res.status).toBe(413);
    expect(res.body.schemas).toEqual([ERROR]);
  });

  it('answers 502 when Keycloak cannot be reached', async () => {
    t.realmScim(ent.realm).failNext(0);
    const res = await scim<ScimError>({ path: 'Users' });
    expect(res.status).toBe(502);
    expect(res.body.schemas).toEqual([ERROR]);
  });

  it("passes Keycloak's own refusal on as it is", async () => {
    t.realmScim(ent.realm).failNext(409);
    const res = await scim<ScimError>({ path: 'Users' });
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe('injected');
  });
});

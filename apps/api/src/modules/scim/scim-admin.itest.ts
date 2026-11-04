import { findActiveScimToken, findScimTokenByHash, listAudit, tenantTx } from '@tenantry/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';
import { hashScimToken } from './tokens.js';

type Ent = TestTenant & { issuer: string; realm: string };
interface ScimView {
  url: string;
  token: { expiresAt: string; lastUsedAt: string | null; createdAt: string } | null;
  defaultRole: 'member' | 'none';
}

let t: TestApp;
let ent: Ent;
let owner: string;

const appPromise = createTestApp();
afterAll(async () => (await appPromise).close());

const generate = (expiresInDays: number, as = owner) =>
  t.request<{ token: string; expiresAt: string }>({
    host: ent.host,
    method: 'POST',
    path: '/api/scim/token',
    token: as,
    body: { expiresInDays },
  });
const stored = (token: string) =>
  tenantTx(t.db, ent.id, (tx) => findScimTokenByHash(tx, hashScimToken(token)));
const view = (as = owner) => t.request<ScimView>({ host: ent.host, path: '/api/scim', token: as });

beforeEach(async () => {
  t = await appPromise;
  ent = await t.seedEnterpriseTenant();
  owner = await t.enterpriseToken(ent, t.newUser(), ['owner']);
});

describe('SCIM tokens', () => {
  it('starts with no token and SCIM off', async () => {
    const res = await view();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: `http://${ent.host}/scim/v2`, token: null, defaultRole: 'member' });
    expect(t.realmScim(ent.realm).enabled).toBe(false);
  });

  it('shows the first token once, keeps only its hash, and turns SCIM on', async () => {
    const res = await generate(90);
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^tnt_scim_/);
    const days = (Date.parse(res.body.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
    expect(t.realmScim(ent.realm).enabled).toBe(true);
    const shown = await view();
    expect(JSON.stringify(shown.body)).not.toContain(res.body.token);
    expect(shown.body.token?.expiresAt).toBe(res.body.expiresAt);
    // Found by its hash: the table holds the hash (the db suite checks it holds nothing else).
    expect((await stored(res.body.token))?.revokedAt).toBeNull();
  });

  it('replaces the active token with a new one', async () => {
    const first = await generate(90);
    const second = await generate(365);
    const active = await tenantTx(t.db, ent.id, (tx) => findActiveScimToken(tx));
    expect(active?.expiresAt.toISOString()).toBe(second.body.expiresAt);
    expect((await stored(first.body.token))?.revokedAt).not.toBeNull();
  });

  it('keeps one active token when two are made at once', async () => {
    const made = await Promise.all([generate(90), generate(180)]);
    expect(made.map((r) => r.status)).toEqual([201, 201]);
    const rows = await Promise.all(made.map((r) => stored(r.body.token)));
    expect(rows.filter((r) => r?.revokedAt === null)).toHaveLength(1);
  });

  it('revokes the token and turns SCIM off', async () => {
    await generate(180);
    const res = await t.request({ host: ent.host, method: 'DELETE', path: '/api/scim/token', token: owner });
    expect(res.status).toBe(204);
    expect((await view()).body.token).toBeNull();
    expect(t.realmScim(ent.realm).enabled).toBe(false);
  });

  it('audits the expiry, never the token', async () => {
    const { body } = await generate(90);
    await t.request({ host: ent.host, method: 'DELETE', path: '/api/scim/token', token: owner });
    const audit = await tenantTx(t.db, ent.id, (tx) => listAudit(tx, { limit: 10 }));
    const created = audit.find((e) => e.action === 'scim.token_created');
    expect(created?.metadata).toEqual({ expiresAt: body.expiresAt });
    expect(audit.some((e) => e.action === 'scim.token_revoked')).toBe(true);
    expect(JSON.stringify(audit)).not.toContain(body.token);
  });

  it('refuses another expiry', async () => {
    expect((await generate(30)).status).toBe(422);
  });

  it('sets the default role', async () => {
    const res = await t.request<ScimView>({
      host: ent.host,
      method: 'PUT',
      path: '/api/scim/default-role',
      token: owner,
      body: { role: 'none' },
    });
    expect(res.status).toBe(200);
    expect((await view()).body.defaultRole).toBe('none');
  });

  it('is for owners of enterprise workspaces only', async () => {
    const admin = await t.enterpriseToken(ent, t.newUser(), ['admin']);
    expect((await generate(90, admin)).status).toBe(403);
    expect((await view(admin)).status).toBe(403);
    const standard = await t.seedTenant();
    const { token } = await t.member(standard, 'owners');
    const res = await t.request<{ detail: string }>({ host: standard.host, path: '/api/scim', token });
    expect(res.status).toBe(404);
  });
});

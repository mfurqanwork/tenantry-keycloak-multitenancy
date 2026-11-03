import { meetsContrast } from '@tenantry/brand';
import { listAudit, platformRepository, tenantTx } from '@tenantry/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp, type TestTenant } from '../../testing/test-app.js';

interface PublicBranding {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
}

let t: TestApp;
let acme: TestTenant;
let owner: { token: string };
let admin: { token: string };

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake png'),
]);

function multipart(bytes: Buffer, contentType = 'image/png', filename = 'logo.png') {
  const boundary = 'tenantryboundary';
  const raw = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { raw, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const upload = (token: string, bytes: Buffer, contentType?: string) =>
  t.request({
    host: acme.host,
    method: 'POST',
    path: '/api/branding/logo',
    token,
    ...multipart(bytes, contentType),
  });
const setColor = (token: string, primaryColor: string | null, host = acme.host) =>
  t.request<Record<string, unknown>>({
    host,
    method: 'PUT',
    path: '/api/branding',
    token,
    body: { primaryColor },
  });
const publicBranding = (slug = acme.slug) =>
  t.request<PublicBranding>({ host: acme.host, path: `/api/tenants/${slug}/branding` });
const actions = async () =>
  (await tenantTx(t.db, acme.id, (tx) => listAudit(tx, { limit: 20 }))).map((e) => e.action);

beforeAll(async () => {
  t = await createTestApp();
  acme = await t.seedTenant();
  owner = await t.member(acme, 'owners');
  admin = await t.member(acme, 'admins');
});
afterAll(() => t.close());

describe('PUT /api/branding', () => {
  it('saves a colour with enough contrast and shows it publicly', async () => {
    const res = await setColor(owner.token, '#0F62FE');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ primaryColor: '#0f62fe' });
    expect((await publicBranding()).body).toMatchObject({
      name: `Tenant ${acme.slug}`,
      primaryColor: '#0f62fe',
    });
    expect(await actions()).toContain('branding.updated');
  });

  it('refuses a colour below 4.5:1 and suggests a darker one', async () => {
    const res = await setColor(owner.token, '#ffcc00');
    expect(res.status).toBe(422);
    const suggestion = res.body['suggestion'];
    expect(typeof suggestion).toBe('string');
    expect(meetsContrast(suggestion as string)).toBe(true);
  });

  it('refuses something that is not #rrggbb', async () => {
    expect((await setColor(owner.token, 'blue')).status).toBe(422);
  });

  it('clears the colour with null', async () => {
    expect((await setColor(owner.token, null)).status).toBe(200);
    expect((await publicBranding()).body.primaryColor).toBeNull();
  });

  it('needs tenant:settings', async () => {
    expect((await setColor(admin.token, '#0f62fe')).status).toBe(403);
  });

  it("refuses a token from another workspace on this workspace's host", async () => {
    const other = await t.seedTenant();
    const outsider = await t.member(other, 'owners');
    expect((await setColor(outsider.token, '#198038')).status).toBe(403);
  });
});

describe('logo', () => {
  it('uploads a PNG and serves the same bytes publicly', async () => {
    const res = await upload(owner.token, PNG);
    expect(res.status).toBe(201);
    const { logoUrl } = (await publicBranding()).body;
    expect(logoUrl).toMatch(new RegExp(`^/api/tenants/${acme.slug}/logo\\?v=\\d+$`));
    const logo = await t.request<Buffer>({ host: acme.host, path: logoUrl ?? '' });
    expect(logo.status).toBe(200);
    expect(logo.headers['content-type']).toBe('image/png');
    expect(logo.headers['x-content-type-options']).toBe('nosniff');
    expect(logo.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(Buffer.compare(logo.body, PNG)).toBe(0);
    expect(await actions()).toContain('branding.logo_updated');
  });

  it('refuses SVG bytes sent as image/png', async () => {
    const res = await upload(
      owner.token,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'image/png',
    );
    expect(res.status).toBe(422);
  });

  it('refuses a file over 256 KB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(262145 - PNG.length)]);
    expect((await upload(owner.token, big)).status).toBe(413);
  });

  it('needs tenant:settings', async () => {
    expect((await upload(admin.token, PNG)).status).toBe(403);
  });

  it('removes the logo', async () => {
    await upload(owner.token, PNG);
    const res = await t.request({
      host: acme.host,
      method: 'DELETE',
      path: '/api/branding/logo',
      token: owner.token,
    });
    expect(res.status).toBe(204);
    expect((await publicBranding()).body.logoUrl).toBeNull();
    expect((await t.request({ host: acme.host, path: `/api/tenants/${acme.slug}/logo` })).status).toBe(404);
    expect(await actions()).toContain('branding.logo_removed');
  });
});

describe('logo addresses', () => {
  it('never reuses an address after a logo is removed, so caches cannot show the old one', async () => {
    await upload(owner.token, PNG);
    const first = (await publicBranding()).body.logoUrl;
    await t.request({ host: acme.host, method: 'DELETE', path: '/api/branding/logo', token: owner.token });
    await upload(owner.token, PNG);
    expect((await publicBranding()).body.logoUrl).not.toBe(first);
  });
});

describe('public branding', () => {
  it('answers 404 for an unknown or failed workspace', async () => {
    expect((await publicBranding('nobody')).status).toBe(404);
    const failed = await t.seedTenant();
    await platformRepository(t.db).markTenantFailed(failed.id);
    expect((await publicBranding(failed.slug)).status).toBe(404);
  });

  it('lets the login page read it from the auth origin only', async () => {
    const auth = new URL(t.config.authUrl).origin;
    const allowed = await t.request({
      host: acme.host,
      path: `/api/tenants/${acme.slug}/branding`,
      headers: { origin: auth },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(auth);
    const other = await t.request({
      host: acme.host,
      path: `/api/tenants/${acme.slug}/branding`,
      headers: { origin: 'http://evil.localhost' },
    });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

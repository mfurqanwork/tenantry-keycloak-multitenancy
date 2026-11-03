import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/repositories/apps.js';
import { tenantApps } from '../src/schema/index.js';
import { tenantTx } from '../src/tenant-tx.js';
import { connect, failure, seedTenant, type SeededTenant } from './fixtures.js';

const conn = connect();
let a: SeededTenant;
let b: SeededTenant;

const app = (createdBy: string) => ({
  clientId: 'app-0a1b2c3d',
  kcClientUuid: '11111111-2222-3333-4444-555555555555',
  name: 'HR portal',
  type: 'web' as const,
  redirectUris: ['https://hr.example.test/callback'],
  postLogoutRedirectUris: [],
  webOrigins: [],
  createdBy,
});

beforeAll(async () => {
  a = await seedTenant(conn.owner);
  b = await seedTenant(conn.owner);
  await tenantTx(conn.db, a.tenantId, (tx) => createApp(tx, app(a.userId)));
});
afterAll(() => conn.close());

describe('guarantee: tenant_apps is isolated', () => {
  it('shows another tenant nothing, and nothing without a tenant', async () => {
    expect(await tenantTx(conn.db, b.tenantId, (tx) => tx.select().from(tenantApps))).toEqual([]);
    expect(await conn.db.select().from(tenantApps)).toEqual([]);
  });

  it('refuses an app written for another tenant', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx.insert(tenantApps).values({ ...app(a.userId), clientId: 'app-99999999', tenantId: b.tenantId }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it('refuses an unknown app type', async () => {
    const reason = await failure(
      tenantTx(conn.db, a.tenantId, (tx) =>
        tx
          .insert(tenantApps)
          .values({ ...app(a.userId), clientId: 'app-88888888', type: 'saml' as unknown as 'web' }),
      ),
    );
    expect(reason).toMatch(/tenant_apps_type/);
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDevUsers } from '../src/dev/dev-users.js';
import { env } from './stack.js';

const users = createDevUsers({
  baseUrl: env('TENANTRY_AUTH_INTERNAL_URL'),
  adminUsername: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
  adminPassword: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
});

describe('dev users (seed only)', () => {
  it('creates a verified user with a password once, and finds it the second time', async () => {
    const email = `seed-${randomUUID().slice(0, 8)}@example.test`;
    const input = { email, firstName: 'Seed', lastName: 'Test', password: `Pw-${randomUUID()}` };
    const first = await users.ensureUser('platform', input);
    expect(first.created).toBe(true);
    const again = await users.ensureUser('platform', input);
    expect(again).toEqual({ id: first.id, created: false });
    const token = await fetch(
      `${env('TENANTRY_AUTH_INTERNAL_URL')}/realms/platform/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'tenantry-isolation-tests',
          client_secret: env('TENANTRY_ISOLATION_CLIENT_SECRET'),
          username: email,
          password: input.password,
        }),
      },
    );
    expect(token.status).toBe(200);
    await users.deleteUser('platform', first.id);
  });

  it('sets the password of a user that already exists without one', async () => {
    const result = await users.ensureUser('corp-demo', {
      email: 'alice@acme.test',
      firstName: 'Alice',
      lastName: 'Anders',
      password: env('SEED_PASSWORD'),
    });
    expect(result.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('marks an existing, unverified user verified and named, with no pending actions', async () => {
    const email = `seed-${randomUUID().slice(0, 8)}@example.test`;
    const base = env('TENANTRY_AUTH_INTERNAL_URL');
    const token = (await (
      await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: env('KC_BOOTSTRAP_ADMIN_USERNAME'),
          password: env('KC_BOOTSTRAP_ADMIN_PASSWORD'),
        }),
      })
    ).json()) as { access_token: string };
    const created = await fetch(`${base}/admin/realms/platform/users`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        username: email,
        email,
        enabled: true,
        emailVerified: false,
        requiredActions: ['VERIFY_EMAIL'],
      }),
    });
    const id = created.headers.get('location')?.split('/').pop() ?? '';
    await users.ensureUser('platform', {
      email,
      firstName: 'A',
      lastName: 'B',
      password: `Pw-${randomUUID()}`,
    });
    const user = (await (
      await fetch(`${base}/admin/realms/platform/users/${id}`, {
        headers: { authorization: `Bearer ${token.access_token}` },
      })
    ).json()) as { emailVerified: boolean; requiredActions: string[]; firstName?: string; lastName?: string };
    expect(user.emailVerified).toBe(true);
    expect(user.requiredActions).toEqual([]);
    // A complete profile, so the first sign-in is not stopped to ask for a name.
    expect(user).toMatchObject({ firstName: 'A', lastName: 'B' });
    await users.deleteUser('platform', id);
  });
});

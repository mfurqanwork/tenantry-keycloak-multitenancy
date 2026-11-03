import { DirectoryError } from '../errors.js';

// Local demo accounts for `pnpm seed`, made with Keycloak's bootstrap admin. Never used by the API, and
// never pointed at a real deployment: the bootstrap admin exists only in the dev stack.
export interface DevUsersOptions {
  baseUrl: string;
  adminUsername: string;
  adminPassword: string;
  fetch?: typeof fetch;
}

export interface DevUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface DevUsers {
  // Finds the user by email or creates it (username = email, email verified), and sets the password.
  ensureUser(realm: string, input: DevUserInput): Promise<{ id: string; created: boolean }>;
  deleteUser(realm: string, id: string): Promise<void>;
}

export function createDevUsers(o: DevUsersOptions): DevUsers {
  const doFetch = o.fetch ?? fetch;

  async function adminToken(): Promise<string> {
    const res = await doFetch(`${o.baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: o.adminUsername,
        password: o.adminPassword,
      }),
    });
    if (!res.ok) throw new DirectoryError('devToken', res.status);
    return ((await res.json()) as { access_token: string }).access_token;
  }

  async function call(operation: string, method: string, url: string, body?: unknown): Promise<Response> {
    const res = await doFetch(url, {
      method,
      headers: {
        authorization: `Bearer ${await adminToken()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new DirectoryError(operation, res.status, await res.text().catch(() => ''));
    return res;
  }

  const users = (realm: string) => `${o.baseUrl}/admin/realms/${encodeURIComponent(realm)}/users`;

  return {
    async ensureUser(realm, input) {
      const found = (await (
        await call('ensureUser', 'GET', `${users(realm)}?email=${encodeURIComponent(input.email)}&exact=true`)
      ).json()) as { id: string }[];
      let id = found[0]?.id;
      const created = !id;
      if (!id) {
        const res = await call('ensureUser', 'POST', users(realm), {
          username: input.email,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          enabled: true,
          emailVerified: true,
        });
        id = res.headers.get('location')?.split('/').pop();
        if (!id) throw new DirectoryError('ensureUser', res.status, 'no Location header');
      }
      await call('ensureUser', 'PUT', `${users(realm)}/${id}/reset-password`, {
        type: 'password',
        value: input.password,
        temporary: false,
      });
      return { id, created };
    },

    async deleteUser(realm, id) {
      await call('deleteUser', 'DELETE', `${users(realm)}/${encodeURIComponent(id)}`);
    },
  };
}

import { highestRole, ROLES, type Role } from '@tenantry/auth';
import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';
import type { Member, MemberDirectory } from '../member-directory.js';
import { API_CLIENT, BACKEND_CLIENT } from './provisioner.js';

export interface RealmMembersOptions {
  baseUrl: string;
  realm: string;
  // The realm's own tenantry-backend secret (ADR-0023): rights in this realm only.
  clientSecret: string;
  fetch?: typeof fetch;
}

interface KcUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  requiredActions?: string[];
}

const PAGE = 1000;

// An enterprise realm's members: its users holding a tenantry-api client role (ADR-0004).
export function createRealmMembers(o: RealmMembersOptions): MemberDirectory {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({
    baseUrl: o.baseUrl,
    realm: o.realm,
    clientId: BACKEND_CLIENT,
    clientSecret: o.clientSecret,
    fetch: doFetch,
  });
  const admin = `${o.baseUrl}/admin/realms/${encodeURIComponent(o.realm)}`;

  async function call(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
    accept: number[] = [],
  ) {
    const res = await doFetch(`${admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await token()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!res.ok && !accept.includes(res.status)) {
      throw new DirectoryError(operation, res.status, await res.text().catch(() => ''));
    }
    return res;
  }
  const json = async <T>(res: Response) => (await res.json()) as T;

  let apiClient: Promise<{ id: string; roles: Map<Role, { id: string; name: string }> }> | null = null;
  const api = () => {
    apiClient ??= (async () => {
      const [client] = await json<{ id: string }[]>(
        await call('api', 'GET', `/clients?clientId=${API_CLIENT}`),
      );
      if (!client) throw new DirectoryError('api', 404, `${API_CLIENT} missing in ${o.realm}`);
      const roles = await json<{ id: string; name: string }[]>(
        await call('api', 'GET', `/clients/${client.id}/roles`),
      );
      return {
        id: client.id,
        roles: new Map(roles.filter((r) => ROLES.includes(r.name as Role)).map((r) => [r.name as Role, r])),
      };
    })().catch((err: unknown) => {
      apiClient = null;
      throw err;
    });
    return apiClient;
  };

  async function moveRole(operation: string, kcUserId: string, role: Role | null) {
    const { id, roles } = await api();
    const mappings = `/users/${encodeURIComponent(kcUserId)}/role-mappings/clients/${id}`;
    const held = await json<{ id: string; name: string }[]>(await call(operation, 'GET', mappings));
    const drop = held.filter((r) => r.name !== role && ROLES.includes(r.name as Role));
    if (drop.length) await call(operation, 'DELETE', mappings, drop);
    const want = role ? roles.get(role) : undefined;
    if (want && !held.some((r) => r.name === role)) await call(operation, 'POST', mappings, [want]);
  }

  async function hasPassword(operation: string, kcUserId: string): Promise<boolean> {
    const credentials = await json<{ type: string }[]>(
      await call(operation, 'GET', `/users/${encodeURIComponent(kcUserId)}/credentials`),
    );
    return credentials.some((c) => c.type === 'password');
  }

  return {
    async listMembers() {
      const { id, roles } = await api();
      const byUser = new Map<string, { user: KcUser; roles: Role[] }>();
      for (const role of roles.keys()) {
        const users = await json<KcUser[]>(
          await call('listMembers', 'GET', `/clients/${id}/roles/${role}/users?first=0&max=${String(PAGE)}`),
        );
        for (const user of users) {
          const entry = byUser.get(user.id) ?? { user, roles: [] };
          entry.roles.push(role);
          byUser.set(user.id, entry);
        }
        // People in a directory group mapped to this role hold it too (SCIM, Phase 5a).
        const groups = await json<{ id: string }[]>(
          await call('listMembers', 'GET', `/clients/${id}/roles/${role}/groups?first=0&max=${String(PAGE)}`),
        );
        for (const group of groups) {
          const members = await json<KcUser[]>(
            await call('listMembers', 'GET', `/groups/${group.id}/members?first=0&max=${String(PAGE)}`),
          );
          for (const user of members) {
            const entry = byUser.get(user.id) ?? { user, roles: [] };
            entry.roles.push(role);
            byUser.set(user.id, entry);
          }
        }
      }
      return [...byUser.values()].map(({ user, roles: held }): Member => ({
        kcUserId: user.id,
        email: user.email ?? null,
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        role: highestRole(held),
      }));
    },

    async invite(email, role) {
      const address = email.toLowerCase();
      const [found] = await json<KcUser[]>(
        await call('invite', 'GET', `/users?email=${encodeURIComponent(address)}&exact=true`),
      );
      let kcUserId = found?.id;
      if (!kcUserId) {
        const res = await call('invite', 'POST', '/users', {
          username: address,
          email: address,
          enabled: true,
          emailVerified: false,
        });
        kcUserId = res.headers.get('location')?.split('/').pop();
        if (!kcUserId) throw new DirectoryError('invite', res.status, 'no Location header');
      }
      await moveRole('invite', kcUserId, role);
      // Also for an account found without a password: an earlier attempt may have stopped before its
      // email went out, and without one the person has no way in.
      if (!(await hasPassword('invite', kcUserId))) {
        await call('invite', 'PUT', `/users/${kcUserId}/execute-actions-email`, [
          'UPDATE_PASSWORD',
          'VERIFY_EMAIL',
        ]);
      }
      return { kcUserId };
    },

    setRole: (kcUserId, role) => moveRole('setRole', kcUserId, role),
    remove: (kcUserId) => moveRole('remove', kcUserId, null),

    // "Never signed in": the account still has no password of its own.
    async deleteUnusedUser(kcUserId) {
      const user = `/users/${encodeURIComponent(kcUserId)}`;
      const found = await call('deleteUnusedUser', 'GET', user, undefined, [404]);
      if (found.status === 404) return false;
      if (await hasPassword('deleteUnusedUser', kcUserId)) return false;
      await call('deleteUnusedUser', 'DELETE', user);
      return true;
    },
  };
}

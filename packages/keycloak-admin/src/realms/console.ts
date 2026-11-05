import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';
import { CONSOLE_GROUP, CONSOLE_ROLE } from './templates.js';

// Scoped console access to one enterprise realm (ADR-0026), through fine-grained admin permissions v2
// (template v4 turns them on). Members of tenantry-console manage people and groups, never owners,
// never who else is in tenantry-console, and nothing else in the realm. Probed on Keycloak 26.8.1.
export interface RealmConsole {
  ensurePermissions(): Promise<void>;
  grant(kcUserId: string): Promise<void>;
  revoke(kcUserId: string): Promise<void>;
  // Replaces the owners console users may see but not change.
  protectOwners(ownerIds: string[]): Promise<void>;
  consoleUrl(): string;
}

export interface RealmConsoleOptions {
  baseUrl: string;
  // The address people's browsers use for Keycloak.
  publicAuthUrl: string;
  realm: string;
  provisionerClientId: string;
  provisionerClientSecret: string;
  fetch?: typeof fetch;
}

const ALLOW = 'console users';
const DENY = 'not console users';
const USERS = 'console users: users';
const OWNERS = 'console users: not owners';
const GROUPS = 'console users: groups';
const CONSOLE_GROUP_DENY = 'console users: not the console group';

interface Named {
  id: string;
  name: string;
}

export function createRealmConsole(o: RealmConsoleOptions): RealmConsole {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({
    baseUrl: o.baseUrl,
    realm: 'master',
    clientId: o.provisionerClientId,
    clientSecret: o.provisionerClientSecret,
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

  async function clientUuid(operation: string, clientId: string): Promise<string> {
    const [found] = await json<{ id: string }[]>(
      await call(operation, 'GET', `/clients?clientId=${encodeURIComponent(clientId)}`),
    );
    if (!found) throw new DirectoryError(operation, 404, `${clientId} not in ${o.realm}`);
    return found.id;
  }

  async function consoleGroupId(operation: string): Promise<string> {
    const found = await json<Named[]>(
      await call(operation, 'GET', `/groups?search=${CONSOLE_GROUP}&exact=true`),
    );
    const id = found.find((g) => g.name === CONSOLE_GROUP)?.id;
    if (!id) throw new DirectoryError(operation, 404, `${CONSOLE_GROUP} not in ${o.realm}`);
    return id;
  }

  async function resourceServer(operation: string): Promise<string> {
    return `/clients/${await clientUuid(operation, 'admin-permissions')}/authz/resource-server`;
  }

  async function findByName(operation: string, rs: string, kind: 'policy' | 'permission', name: string) {
    const list = await json<Named[]>(
      await call(operation, 'GET', `${rs}/${kind}?name=${encodeURIComponent(name)}&first=0&max=50`),
    );
    return list.find((p) => p.name === name) ?? null;
  }

  async function ensureGroupPolicy(
    rs: string,
    name: string,
    groupId: string,
    logic: string,
  ): Promise<string> {
    const found = await findByName('ensurePermissions', rs, 'policy', name);
    const rep = { name, type: 'group', groups: [{ id: groupId }], logic };
    if (found) {
      await call('ensurePermissions', 'PUT', `${rs}/policy/group/${found.id}`, { ...rep, id: found.id });
      return found.id;
    }
    return (await json<{ id: string }>(await call('ensurePermissions', 'POST', `${rs}/policy/group`, rep)))
      .id;
  }

  async function putPermission(
    operation: string,
    rs: string,
    rep: { name: string; resourceType: string; scopes: string[]; policies: string[]; resources?: string[] },
  ): Promise<void> {
    const found = await findByName(operation, rs, 'permission', rep.name);
    if (found) {
      await call(operation, 'PUT', `${rs}/permission/scope/${found.id}`, { ...rep, id: found.id });
    } else {
      await call(operation, 'POST', `${rs}/permission/scope`, rep);
    }
  }

  return {
    // Last of a realm's set-up steps: with admin permissions on, the provisioner can no longer map
    // realm-management roles, so the groups and clients that need them are made first.
    async ensurePermissions() {
      await call('ensurePermissions', 'PUT', '', { adminPermissionsEnabled: true });
      const rs = await resourceServer('ensurePermissions');
      const group = await consoleGroupId('ensurePermissions');
      const allow = await ensureGroupPolicy(rs, ALLOW, group, 'POSITIVE');
      const deny = await ensureGroupPolicy(rs, DENY, group, 'NEGATIVE');
      await putPermission('ensurePermissions', rs, {
        name: USERS,
        resourceType: 'Users',
        scopes: ['view', 'manage', 'reset-password', 'manage-group-membership'],
        policies: [allow],
      });
      await putPermission('ensurePermissions', rs, {
        name: GROUPS,
        resourceType: 'Groups',
        scopes: ['view', 'view-members', 'manage-membership'],
        policies: [allow],
      });
      await putPermission('ensurePermissions', rs, {
        name: CONSOLE_GROUP_DENY,
        resourceType: 'Groups',
        resources: [group],
        scopes: ['manage', 'manage-membership', 'manage-members'],
        policies: [deny],
      });
    },

    // The group is what the permissions name; the role carries the two query roles the console needs to
    // start. Both are ones the provisioner may still grant with admin permissions on (probed, ADR-0026).
    // The role first, the group (what the permissions name) last; a failed group change takes the role back.
    async grant(kcUserId) {
      const id = encodeURIComponent(kcUserId);
      const role = await json<Named>(await call('grantConsole', 'GET', `/roles/${CONSOLE_ROLE}`));
      await call('grantConsole', 'POST', `/users/${id}/role-mappings/realm`, [role]);
      try {
        await call('grantConsole', 'PUT', `/users/${id}/groups/${await consoleGroupId('grantConsole')}`);
      } catch (err) {
        await call('grantConsole', 'DELETE', `/users/${id}/role-mappings/realm`, [role], [404]).catch(
          () => undefined,
        );
        throw err;
      }
    },

    async revoke(kcUserId) {
      const id = encodeURIComponent(kcUserId);
      const group = await consoleGroupId('revokeConsole');
      await call('revokeConsole', 'DELETE', `/users/${id}/groups/${group}`, undefined, [404]);
      const role = await json<Named>(await call('revokeConsole', 'GET', `/roles/${CONSOLE_ROLE}`));
      await call('revokeConsole', 'DELETE', `/users/${id}/role-mappings/realm`, [role], [404]);
    },

    async protectOwners(ownerIds) {
      const rs = await resourceServer('protectOwners');
      // A v2 permission that names no resource covers every user: with no owner, there is no deny.
      if (ownerIds.length === 0) {
        const found = await findByName('protectOwners', rs, 'permission', OWNERS);
        if (found) await call('protectOwners', 'DELETE', `${rs}/permission/${found.id}`, undefined, [404]);
        return;
      }
      const deny = await findByName('protectOwners', rs, 'policy', DENY);
      if (!deny) throw new DirectoryError('protectOwners', 404, 'console permissions not set up');
      await putPermission('protectOwners', rs, {
        name: OWNERS,
        resourceType: 'Users',
        resources: [...new Set(ownerIds)],
        scopes: ['manage', 'reset-password', 'manage-group-membership', 'impersonate', 'map-roles'],
        policies: [deny.id],
      });
    },

    consoleUrl() {
      return `${o.publicAuthUrl}/admin/${o.realm}/console/`;
    },
  };
}

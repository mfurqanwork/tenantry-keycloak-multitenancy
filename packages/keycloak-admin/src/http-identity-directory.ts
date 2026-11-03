import { roleForGroupPath, ROLES, groupForRole, type GroupName, type TenantApp } from '@tenantry/auth';
import { createAdminTokenSource } from './admin-token.js';
import { DirectoryError } from './errors.js';
import type { DirectoryMember, IdentityDirectory } from './identity-directory.js';

export interface HttpIdentityDirectoryOptions {
  // Where this process reaches Keycloak (container or loopback address), not the public issuer URL.
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  // The SPA clients whose redirect URIs list each tenant's origins.
  webClientId: string;
  portalClientId: string;
  fetch?: typeof fetch;
}

interface KcUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}
interface KcGroup {
  id: string;
  name: string;
  path?: string;
}
interface KcOrganization {
  id: string;
  domains?: { name: string; verified?: boolean; identityProviderAlias?: string; autoRedirect?: boolean }[];
}
interface KcClient {
  id: string;
  redirectUris?: string[];
  webOrigins?: string[];
}

const GROUPS: readonly GroupName[] = ROLES.map(groupForRole);

export function createHttpIdentityDirectory(o: HttpIdentityDirectoryOptions): IdentityDirectory {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({ ...o, fetch: doFetch });
  const admin = `${o.baseUrl}/admin/realms/${o.realm}`;

  async function call(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
    accept: number[] = [],
  ): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${await token()}` };
    let payload: string | URLSearchParams | undefined;
    if (body instanceof URLSearchParams) payload = body;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await doFetch(`${admin}${path}`, { method, headers, body: payload ?? null });
    if (!res.ok && !accept.includes(res.status)) {
      throw new DirectoryError(operation, res.status, await res.text().catch(() => ''));
    }
    return res;
  }

  const json = async <T>(res: Response) => (await res.json()) as T;
  const org = (orgId: string) => `/organizations/${encodeURIComponent(orgId)}`;

  async function groupIds(orgId: string): Promise<Map<GroupName, string>> {
    const groups = await json<KcGroup[]>(await call('listGroups', 'GET', `${org(orgId)}/groups`));
    const ids = new Map<GroupName, string>();
    for (const g of groups) {
      const role = roleForGroupPath(g.name);
      if (role) ids.set(groupForRole(role), g.id);
    }
    return ids;
  }

  // Concurrent signups would otherwise read-modify-write a client and lose each other's origins.
  let clientQueue: Promise<unknown> = Promise.resolve();
  function editAppClient(operation: string, app: TenantApp, edit: (c: KcClient) => KcClient): Promise<void> {
    const clientId = app === 'portal' ? o.portalClientId : o.webClientId;
    const run = clientQueue.then(async () => {
      const [client] = await json<KcClient[]>(
        await call(operation, 'GET', `/clients?clientId=${encodeURIComponent(clientId)}`),
      );
      if (!client) throw new DirectoryError(operation, 404, `client ${clientId} not found`);
      await call(operation, 'PUT', `/clients/${client.id}`, edit(client));
    });
    clientQueue = run.catch(() => undefined);
    return run;
  }

  return {
    async createOrganization(input) {
      const res = await call('createOrganization', 'POST', '/organizations', { ...input, domains: [] });
      const id = res.headers.get('location')?.split('/').pop();
      if (!id) throw new DirectoryError('createOrganization', res.status, 'no Location header');
      return { id };
    },

    // Keycloak's search matches names; organizations are named by their alias (ADR-0018), so search
    // by it and keep only an exact alias match.
    async findOrganizationByAlias(alias) {
      const found = await json<{ id: string; alias: string }[]>(
        await call(
          'findOrganizationByAlias',
          'GET',
          `/organizations?search=${encodeURIComponent(alias)}&exact=true`,
        ),
      );
      const match = found.find((o) => o.alias === alias);
      return match ? { id: match.id } : null;
    },

    async deleteOrganization(orgId) {
      await call('deleteOrganization', 'DELETE', org(orgId), undefined, [404]);
    },

    async createGroups(orgId) {
      for (const name of GROUPS) {
        await call('createGroups', 'POST', `${org(orgId)}/groups`, { name });
      }
    },

    async addMember(orgId, kcUserId) {
      await call('addMember', 'POST', `${org(orgId)}/members`, kcUserId, [409]);
    },

    async removeMember(orgId, kcUserId) {
      await call(
        'removeMember',
        'DELETE',
        `${org(orgId)}/members/${encodeURIComponent(kcUserId)}`,
        undefined,
        [404],
      );
    },

    async setMemberGroup(orgId, kcUserId, group) {
      const ids = await groupIds(orgId);
      const target = ids.get(group);
      if (!target) throw new DirectoryError('setMemberGroup', 404, `group ${group} missing`);
      const member = encodeURIComponent(kcUserId);
      const current = await json<KcGroup[]>(
        await call('setMemberGroup', 'GET', `${org(orgId)}/members/${member}/groups`),
      );
      if (!current.some((g) => g.id === target)) {
        await call('setMemberGroup', 'PUT', `${org(orgId)}/groups/${target}/members/${member}`);
      }
      // Keycloak answers 400 for leaving a group you are not in, so leave only the ones held.
      for (const g of current) {
        if (g.id !== target && [...ids.values()].includes(g.id)) {
          await call('setMemberGroup', 'DELETE', `${org(orgId)}/groups/${g.id}/members/${member}`);
        }
      }
    },

    async listMembers(orgId) {
      const users = await json<KcUser[]>(await call('listMembers', 'GET', `${org(orgId)}/members?max=1000`));
      const groupOf = new Map<string, GroupName>();
      // Highest role first, so a user in two groups lands in the higher one.
      for (const [name, id] of [...(await groupIds(orgId))].reverse()) {
        const inGroup = await json<KcUser[]>(
          await call('listMembers', 'GET', `${org(orgId)}/groups/${id}/members?max=1000`),
        );
        for (const u of inGroup) groupOf.set(u.id, name);
      }
      return users.map((u): DirectoryMember => ({
        kcUserId: u.id,
        email: u.email ?? null,
        displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ?? null),
        group: groupOf.get(u.id) ?? null,
      }));
    },

    async listUserOrganizations(kcUserId) {
      const orgs = await json<{ id: string; alias: string; name: string }[]>(
        await call(
          'listUserOrganizations',
          'GET',
          `/organizations/members/${encodeURIComponent(kcUserId)}/organizations`,
        ),
      );
      return orgs.map(({ id, alias, name }) => ({ id, alias, name }));
    },

    async inviteUser(orgId, email) {
      await call('inviteUser', 'POST', `${org(orgId)}/members/invite-user`, new URLSearchParams({ email }));
    },

    addTenantOrigin(origin, app) {
      const uri = `${origin}/*`;
      return editAppClient('addTenantOrigin', app, (c) => ({
        ...c,
        redirectUris: [...new Set([...(c.redirectUris ?? []), uri])],
        webOrigins: [...new Set([...(c.webOrigins ?? []), origin])],
      }));
    },

    async addOrganizationDomain(orgId, domain) {
      const current = await json<KcOrganization>(await call('addOrganizationDomain', 'GET', org(orgId)));
      const domains = current.domains ?? [];
      if (domains.some((d) => d.name === domain)) return;
      await call('addOrganizationDomain', 'PUT', org(orgId), {
        ...current,
        domains: [...domains, { name: domain, verified: true }],
      });
    },

    async createOidcIdentityProvider(input) {
      // Keycloak reads the issuer's discovery document itself and returns the endpoint settings.
      const discovered = await json<Record<string, string>>(
        await call('createOidcIdentityProvider', 'POST', '/identity-provider/import-config', {
          providerId: 'oidc',
          fromUrl: `${input.issuer}/.well-known/openid-configuration`,
        }),
      );
      const res = await call(
        'createOidcIdentityProvider',
        'POST',
        '/identity-provider/instances',
        {
          alias: input.alias,
          providerId: 'oidc',
          enabled: true,
          trustEmail: true,
          config: {
            ...discovered,
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            clientAuthMethod: 'client_secret_post',
            syncMode: 'IMPORT',
            defaultScope: 'openid email profile',
          },
        },
        [409],
      );
      return { created: res.status !== 409 };
    },

    // Keycloak 26.8 keeps the provider for a domain on the organization's domain entry.
    async linkIdentityProvider(orgId, alias, domain) {
      await call('linkIdentityProvider', 'POST', `${org(orgId)}/identity-providers`, alias, [409]);
      const current = await json<KcOrganization>(await call('linkIdentityProvider', 'GET', org(orgId)));
      const domains = current.domains ?? [];
      if (!domains.some((d) => d.name === domain)) {
        throw new DirectoryError('linkIdentityProvider', 400, `organization has no domain ${domain}`);
      }
      await call('linkIdentityProvider', 'PUT', org(orgId), {
        ...current,
        domains: domains.map((d) =>
          d.name === domain ? { ...d, identityProviderAlias: alias, autoRedirect: true } : d,
        ),
      });
    },

    async deleteIdentityProvider(alias) {
      await call(
        'deleteIdentityProvider',
        'DELETE',
        `/identity-provider/instances/${encodeURIComponent(alias)}`,
        undefined,
        [404],
      );
    },

    removeTenantOrigin(origin, app) {
      const uri = `${origin}/*`;
      return editAppClient('removeTenantOrigin', app, (c) => ({
        ...c,
        redirectUris: (c.redirectUris ?? []).filter((u) => u !== uri),
        webOrigins: (c.webOrigins ?? []).filter((w) => w !== origin),
      }));
    },
  };
}

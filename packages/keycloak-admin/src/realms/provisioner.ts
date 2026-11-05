import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';
import type { SecuritySettings, TwoStep } from '@tenantry/auth';
import { secondStepRequirements, securityRealmPatch } from './security.js';
import { diffTemplate, type TemplateDiff } from './template-diff.js';
import {
  CONSOLE_GROUP,
  CONSOLE_QUERY_ROLES,
  CONSOLE_ROLE,
  MAPPED_GROUPS,
  type ClientTemplate,
  type RealmTemplate,
  type SecondStep,
} from './templates.js';

// Builds and upgrades enterprise realms (ADR-0010) with the master-realm account that may only create
// realms; Keycloak makes it admin of the realms it creates. Every step can run again without effect.
export interface RealmProvisioner {
  ensureRealm(realm: string): Promise<{ created: boolean }>;
  // An aborted move's half-built realm (ADR-0025); a missing realm counts as deleted.
  deleteRealm(realm: string): Promise<void>;
  applyTemplate(realm: string, template: RealmTemplate): Promise<void>;
  ensureClients(realm: string, clients: ClientTemplate[]): Promise<void>;
  setBackendSecret(realm: string, secret: string): Promise<void>;
  // The first owner; the set-password email goes out on every run until they have a password.
  ensureFirstAdmin(
    realm: string,
    email: string,
    webOrigin: string,
  ): Promise<{ created: boolean; kcUserId: string }>;
  // Discovery and keys answer, and the backend client gets a token with this secret.
  smokeTest(realm: string, backendSecret: string): Promise<void>;
  // An owner's sign-in rules (Phase 5a): realm settings and the second step of the browser flow.
  applySecurity(realm: string, settings: SecuritySettings, secondStep: SecondStep): Promise<void>;
  // The directory groups that give a tenantry-api role (SCIM), each created once.
  ensureGroups(realm: string): Promise<void>;
  // What applyTemplate and ensureClients would change; changes nothing.
  diff(realm: string, template: RealmTemplate, clients: ClientTemplate[]): Promise<TemplateDiff[]>;
}

export interface HttpRealmProvisionerOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

interface KcClient {
  id: string;
  clientId: string;
  [key: string]: unknown;
}

export const API_CLIENT = 'tenantry-api';
export const BACKEND_CLIENT = 'tenantry-backend';

export function createHttpRealmProvisioner(o: HttpRealmProvisionerOptions): RealmProvisioner {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({ ...o, realm: 'master', fetch: doFetch });
  const admin = `${o.baseUrl}/admin/realms`;

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
  const r = (realm: string) => `/${encodeURIComponent(realm)}`;

  async function findClient(operation: string, realm: string, clientId: string): Promise<KcClient | null> {
    const [found] = await json<KcClient[]>(
      await call(operation, 'GET', `${r(realm)}/clients?clientId=${encodeURIComponent(clientId)}`),
    );
    return found ?? null;
  }

  async function client(operation: string, realm: string, clientId: string): Promise<KcClient> {
    const found = await findClient(operation, realm, clientId);
    if (!found) throw new DirectoryError(operation, 404, `client ${clientId} missing in ${realm}`);
    return found;
  }

  async function grantServiceAccountRoles(realm: string, kcClient: KcClient, roles: string[]) {
    if (roles.length === 0) return;
    const user = await json<{ id: string }>(
      await call('ensureClients', 'GET', `${r(realm)}/clients/${kcClient.id}/service-account-user`),
    );
    const management = await client('ensureClients', realm, 'realm-management');
    const available = await json<{ id: string; name: string }[]>(
      await call('ensureClients', 'GET', `${r(realm)}/clients/${management.id}/roles`),
    );
    const mappings = `${r(realm)}/users/${user.id}/role-mappings/clients/${management.id}`;
    await grantMissing(
      'ensureClients',
      mappings,
      available.filter((role) => roles.includes(role.name)),
    );
  }

  // Only the roles not held yet: once admin permissions v2 are on, Keycloak refuses the provisioner any
  // realm-management mapping, even one already held (ADR-0026). A rerun then changes nothing.
  async function grantMissing(operation: string, mappings: string, wanted: { id: string; name: string }[]) {
    const held = new Set(
      (await json<{ name: string }[]>(await call(operation, 'GET', mappings))).map((role) => role.name),
    );
    const missing = wanted.filter((role) => !held.has(role.name));
    if (missing.length > 0) await call(operation, 'POST', mappings, missing);
  }

  interface Execution {
    id: string;
    displayName: string;
    requirement: string;
    [key: string]: unknown;
  }
  const executionsOf = async (operation: string, realm: string, step: SecondStep) =>
    json<Execution[]>(
      await call(
        operation,
        'GET',
        `${r(realm)}/authentication/flows/${encodeURIComponent(step.flow)}/executions`,
      ),
    );

  async function setSecondStep(operation: string, realm: string, step: SecondStep, twoStep: TwoStep) {
    const want = secondStepRequirements(step, twoStep);
    for (const e of await executionsOf(operation, realm, step)) {
      const requirement = want[e.displayName];
      if (requirement && e.requirement !== requirement) {
        await call(
          operation,
          'PUT',
          `${r(realm)}/authentication/flows/${encodeURIComponent(step.flow)}/executions`,
          {
            ...e,
            requirement,
          },
        );
      }
    }
  }

  return {
    async deleteRealm(realm) {
      await call('deleteRealm', 'DELETE', r(realm), undefined, [404]);
    },

    async ensureRealm(realm) {
      const found = await call('ensureRealm', 'GET', r(realm), undefined, [404]);
      if (found.status !== 404) return { created: false };
      await call('ensureRealm', 'POST', '', { realm, enabled: true });
      return { created: true };
    },

    async applyTemplate(realm, template) {
      await call('applyTemplate', 'PUT', r(realm), template.realm);
      await call('applyTemplate', 'PUT', `${r(realm)}/client-policies/profiles`, template.clientProfiles);
      await call('applyTemplate', 'PUT', `${r(realm)}/client-policies/policies`, template.clientPolicies);
      await setSecondStep('applyTemplate', realm, template.secondStep, template.twoStep);
    },

    async applySecurity(realm, settings, secondStep) {
      await call('applySecurity', 'PUT', r(realm), securityRealmPatch(settings));
      await setSecondStep('applySecurity', realm, secondStep, settings.twoStep);
    },

    async ensureGroups(realm) {
      const api = await client('ensureGroups', realm, API_CLIENT);
      for (const [name, role] of Object.entries(MAPPED_GROUPS)) {
        const found = await json<{ id: string; name: string }[]>(
          await call(
            'ensureGroups',
            'GET',
            `${r(realm)}/groups?search=${encodeURIComponent(name)}&exact=true`,
          ),
        );
        let id = found.find((g) => g.name === name)?.id;
        if (!id) {
          const res = await call('ensureGroups', 'POST', `${r(realm)}/groups`, { name });
          id = res.headers.get('location')?.split('/').pop();
          if (!id) throw new DirectoryError('ensureGroups', res.status, 'no Location header');
        }
        const roleRep = await json<{ id: string; name: string }>(
          await call('ensureGroups', 'GET', `${r(realm)}/clients/${api.id}/roles/${role}`),
        );
        await grantMissing('ensureGroups', `${r(realm)}/groups/${id}/role-mappings/clients/${api.id}`, [
          roleRep,
        ]);
      }
      // The console group gives no role; the console's two query roles are the composite of a plain realm
      // role made here, before admin permissions go on (ADR-0026).
      const consoleGroups = await json<{ id: string; name: string }[]>(
        await call('ensureGroups', 'GET', `${r(realm)}/groups?search=${CONSOLE_GROUP}&exact=true`),
      );
      if (!consoleGroups.some((g) => g.name === CONSOLE_GROUP)) {
        await call('ensureGroups', 'POST', `${r(realm)}/groups`, { name: CONSOLE_GROUP });
      }
      const existing = await call(
        'ensureGroups',
        'GET',
        `${r(realm)}/roles/${CONSOLE_ROLE}`,
        undefined,
        [404],
      );
      if (existing.status === 404) {
        await call('ensureGroups', 'POST', `${r(realm)}/roles`, {
          name: CONSOLE_ROLE,
          description: 'Opens the realm console; Tenantry grants it with tenantry-console (ADR-0026).',
        });
      }
      const consoleRole = await json<{ id: string }>(
        await call('ensureGroups', 'GET', `${r(realm)}/roles/${CONSOLE_ROLE}`),
      );
      const management = await client('ensureGroups', realm, 'realm-management');
      const managementRoles = await json<{ id: string; name: string }[]>(
        await call('ensureGroups', 'GET', `${r(realm)}/clients/${management.id}/roles`),
      );
      const composites = `${r(realm)}/roles-by-id/${consoleRole.id}/composites`;
      const held = new Set(
        (await json<{ name: string }[]>(await call('ensureGroups', 'GET', composites))).map(
          (role) => role.name,
        ),
      );
      const missing = managementRoles.filter(
        (role) => CONSOLE_QUERY_ROLES.includes(role.name) && !held.has(role.name),
      );
      if (missing.length > 0) await call('ensureGroups', 'POST', composites, missing);
    },

    async ensureClients(realm, clients) {
      for (const c of clients) {
        const clientId = String(c.representation['clientId']);
        const existing = await findClient('ensureClients', realm, clientId);
        if (existing) {
          await call('ensureClients', 'PUT', `${r(realm)}/clients/${existing.id}`, {
            ...existing,
            ...c.representation,
          });
        } else {
          await call('ensureClients', 'POST', `${r(realm)}/clients`, c.representation);
        }
        const kcClient = await client('ensureClients', realm, clientId);
        for (const name of c.roles) {
          const role = await call(
            'ensureClients',
            'GET',
            `${r(realm)}/clients/${kcClient.id}/roles/${encodeURIComponent(name)}`,
            undefined,
            [404],
          );
          if (role.status === 404) {
            await call('ensureClients', 'POST', `${r(realm)}/clients/${kcClient.id}/roles`, { name });
          }
        }
        await grantServiceAccountRoles(realm, kcClient, c.serviceAccountRoles);
      }
    },

    async setBackendSecret(realm, secret) {
      const backend = await client('setBackendSecret', realm, BACKEND_CLIENT);
      await call('setBackendSecret', 'PUT', `${r(realm)}/clients/${backend.id}`, { ...backend, secret });
    },

    async ensureFirstAdmin(realm, email, webOrigin) {
      const users = `${r(realm)}/users`;
      const [found] = await json<{ id: string }[]>(
        await call('ensureFirstAdmin', 'GET', `${users}?email=${encodeURIComponent(email)}&exact=true`),
      );
      let kcUserId = found?.id;
      const created = !kcUserId;
      if (!kcUserId) {
        const res = await call('ensureFirstAdmin', 'POST', users, {
          username: email,
          email,
          enabled: true,
          emailVerified: false,
        });
        kcUserId = res.headers.get('location')?.split('/').pop();
        if (!kcUserId) throw new DirectoryError('ensureFirstAdmin', res.status, 'no Location header');
      }
      const api = await client('ensureFirstAdmin', realm, API_CLIENT);
      const owner = await json<{ id: string; name: string }>(
        await call('ensureFirstAdmin', 'GET', `${r(realm)}/clients/${api.id}/roles/owner`),
      );
      await call('ensureFirstAdmin', 'POST', `${users}/${kcUserId}/role-mappings/clients/${api.id}`, [owner]);
      // Until the owner has a password, every run sends the email: an earlier run may have stopped
      // between creating the account and sending it.
      const credentials = await json<{ type: string }[]>(
        await call('ensureFirstAdmin', 'GET', `${users}/${kcUserId}/credentials`),
      );
      if (!credentials.some((c) => c.type === 'password')) {
        const query = new URLSearchParams({ client_id: 'tenantry-web', redirect_uri: `${webOrigin}/` });
        await call(
          'ensureFirstAdmin',
          'PUT',
          `${users}/${kcUserId}/execute-actions-email?${query.toString()}`,
          ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
        );
      }
      return { created, kcUserId };
    },

    async smokeTest(realm, backendSecret) {
      const oidc = `${o.baseUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect`;
      for (const url of [
        `${o.baseUrl}/realms/${encodeURIComponent(realm)}/.well-known/openid-configuration`,
        `${oidc}/certs`,
      ]) {
        const res = await doFetch(url);
        if (!res.ok) throw new DirectoryError('smokeTest', res.status, url);
      }
      const res = await doFetch(`${oidc}/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: BACKEND_CLIENT,
          client_secret: backendSecret,
        }),
      });
      if (!res.ok) throw new DirectoryError('smokeTest', res.status, 'backend token refused');
    },

    async diff(realm, template, clients) {
      const live = await json<Record<string, unknown>>(await call('diff', 'GET', r(realm)));
      const profiles = await json<Record<string, unknown>>(
        await call('diff', 'GET', `${r(realm)}/client-policies/profiles`),
      );
      const policies = await json<Record<string, unknown>>(
        await call('diff', 'GET', `${r(realm)}/client-policies/policies`),
      );
      const out = [
        ...diffTemplate({ realm: template.realm }, { realm: live }),
        ...diffTemplate({ clientProfiles: template.clientProfiles }, { clientProfiles: profiles }),
        ...diffTemplate({ clientPolicies: template.clientPolicies }, { clientPolicies: policies }),
      ];
      const want = secondStepRequirements(template.secondStep, template.twoStep);
      for (const e of await executionsOf('diff', realm, template.secondStep)) {
        const expected = want[e.displayName];
        if (expected && e.requirement !== expected) {
          out.push({ path: `secondStep.${e.displayName}`, live: e.requirement, template: expected });
        }
      }
      for (const c of clients) {
        const clientId = String(c.representation['clientId']);
        const found = await findClient('diff', realm, clientId);
        const wanted = Object.fromEntries(
          Object.entries(c.representation).filter(([key]) => key !== 'clientId'),
        );
        out.push(...diffTemplate({ [clientId]: wanted }, { [clientId]: found ?? undefined }, 'clients'));
      }
      return out;
    },
  };
}

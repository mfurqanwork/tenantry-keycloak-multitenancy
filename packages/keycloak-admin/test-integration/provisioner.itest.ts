import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { SECURITY_DEFAULTS } from '@tenantry/auth';
import { securityRealmPatch } from '../src/realms/security.js';
import {
  loadProductClients,
  loadRealmTemplate,
  MAPPED_GROUPS,
  TEMPLATE_VERSION,
} from '../src/realms/templates.js';
import { mailsTo } from './mailpit.js';
import { bootstrap, passwordSignIn, testProvisioner, testRealmVars } from './stack.js';

const realm = `ent-it${randomBytes(3).toString('hex')}`;
const vars = testRealmVars(realm, 'Integration Co');
const template = loadRealmTemplate(TEMPLATE_VERSION, vars);
const clients = loadProductClients(vars);
const adminEmail = `owner-${realm}@example.test`;
const secret = randomBytes(32).toString('base64url');
const provisioner = testProvisioner();

afterAll(async () => {
  await bootstrap('DELETE', `/${realm}`);
});

describe('realm provisioner (Keycloak)', () => {
  it('creates the realm once', async () => {
    expect(await provisioner.ensureRealm(realm)).toEqual({ created: true });
    expect(await provisioner.ensureRealm(realm)).toEqual({ created: false });
  });

  it('applies the template, the product clients and the backend secret, twice without change', async () => {
    for (let run = 0; run < 2; run++) {
      await provisioner.applyTemplate(realm, template);
      await provisioner.ensureClients(realm, clients);
      await provisioner.setBackendSecret(realm, secret);
    }
    expect(await provisioner.diff(realm, template, clients)).toEqual([]);
    const list = (await (await bootstrap('GET', `/${realm}/clients`)).json()) as { clientId: string }[];
    const ours = list.map((c) => c.clientId).filter((id) => id.startsWith('tenantry-'));
    expect(ours.sort()).toEqual(['tenantry-api', 'tenantry-backend', 'tenantry-portal', 'tenantry-web']);
  });

  it('creates the first admin once, as owner, with a set-password email until they have a password', async () => {
    const first = await provisioner.ensureFirstAdmin(realm, adminEmail, vars.webOrigin);
    expect(first.created).toBe(true);
    const again = await provisioner.ensureFirstAdmin(realm, adminEmail, vars.webOrigin);
    expect(again).toEqual({ created: false, kcUserId: first.kcUserId });
    const [api] = (await (await bootstrap('GET', `/${realm}/clients?clientId=tenantry-api`)).json()) as {
      id: string;
    }[];
    const roles = (await (
      await bootstrap('GET', `/${realm}/users/${first.kcUserId}/role-mappings/clients/${api?.id ?? ''}`)
    ).json()) as { name: string }[];
    expect(roles.map((r) => r.name)).toEqual(['owner']);
    // A rerun sends the email again while the owner has no password: an earlier run may have stopped
    // before its email went out. Once they have one, nothing more is sent.
    expect(await mailsTo(adminEmail)).toBe(2);
    await bootstrap('PUT', `/${realm}/users/${first.kcUserId}/reset-password`, {
      type: 'password',
      value: `Pw-${randomBytes(12).toString('base64url')}`,
      temporary: false,
    });
    await provisioner.ensureFirstAdmin(realm, adminEmail, vars.webOrigin);
    expect(await mailsTo(adminEmail)).toBe(2);
  });

  it('passes its smoke test with the backend secret', async () => {
    await expect(provisioner.smokeTest(realm, secret)).resolves.toBeUndefined();
    await expect(provisioner.smokeTest(realm, 'wrong')).rejects.toThrow();
  });

  it('reports drift without changing anything', async () => {
    await bootstrap('PUT', `/${realm}`, { accessTokenLifespan: 900 });
    expect(await provisioner.diff(realm, template, clients)).toEqual([
      { path: 'realm.accessTokenLifespan', live: 900, template: 300 },
    ]);
    const live = (await (await bootstrap('GET', `/${realm}`)).json()) as { accessTokenLifespan: number };
    expect(live.accessTokenLifespan).toBe(900);
    await provisioner.applyTemplate(realm, template);
    expect(await provisioner.diff(realm, template, clients)).toEqual([]);
  });

  // Keycloak's secure-redirect-URI check refuses plain http and a bare "*" on every client. It lets
  // "https://*.host/cb" through, but matches "*" only at the end of a path, so such a host never matches;
  // our API refuses it before Keycloak sees it (ADR-0011).
  it('a realm on the template over https refuses an http redirect on any client', async () => {
    await provisioner.applyTemplate(
      realm,
      loadRealmTemplate(TEMPLATE_VERSION, { ...vars, allowHttpRedirects: false }),
    );
    for (const [publicClient, uri] of [
      [false, 'http://hr.example.test/cb'],
      [true, 'http://hr.example.test/cb'],
      [false, '*'],
    ] as const) {
      const res = await bootstrap('POST', `/${realm}/clients`, {
        clientId: `bad-${randomBytes(3).toString('hex')}`,
        publicClient,
        standardFlowEnabled: true,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        redirectUris: [uri],
        attributes: { 'pkce.code.challenge.method': 'S256' },
      });
      expect(res.status, `${uri} (public: ${String(publicClient)})`).toBe(400);
    }
    await provisioner.applyTemplate(realm, template);
  });

  it('applies security settings: the realm takes them, and the second step follows the choice', async () => {
    const custom = {
      ...SECURITY_DEFAULTS,
      passwordMinLength: 14,
      passwordHistory: 3,
      sessionIdleMinutes: 20,
    };
    await provisioner.applySecurity(realm, custom, template.secondStep);
    const live = (await (await bootstrap('GET', `/${realm}`)).json()) as Record<string, unknown>;
    expect(live).toMatchObject(securityRealmPatch(custom));

    const password = `Pw-${randomBytes(12).toString('base64url')}`;
    const username = `two-step-${realm}@example.test`;
    await bootstrap('POST', `/${realm}/users`, {
      username,
      email: username,
      firstName: 'Two',
      lastName: 'Step',
      emailVerified: true,
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    });
    const signIn = () =>
      passwordSignIn({
        realm,
        clientId: 'tenantry-web',
        redirectUri: `${vars.webOrigin}/`,
        username,
        password,
      });
    for (const [twoStep, toApp] of [
      ['optional', true],
      ['required', false],
      ['off', true],
    ] as const) {
      await provisioner.applySecurity(realm, { ...custom, twoStep }, template.secondStep);
      expect((await signIn()).toApp, twoStep).toBe(toApp);
    }
  });

  it('reports a second step changed by hand as drift', async () => {
    await provisioner.applyTemplate(realm, template);
    expect(await provisioner.diff(realm, template, clients)).toEqual([]);
    await provisioner.applySecurity(realm, SECURITY_DEFAULTS, template.secondStep);
    const changed = { ...template, twoStep: 'required' as const };
    const diff = await provisioner.diff(realm, changed, clients);
    expect(diff.map((d) => d.path)).toContain('secondStep.Browser - Conditional 2FA');
    await provisioner.applyTemplate(realm, template);
  });

  it('creates the two mapped groups once, each giving its role', async () => {
    await provisioner.ensureGroups(realm);
    await provisioner.ensureGroups(realm);
    for (const [name, role] of Object.entries(MAPPED_GROUPS)) {
      const found = (await (await bootstrap('GET', `/${realm}/groups?search=${name}&exact=true`)).json()) as {
        id: string;
        name: string;
      }[];
      expect(found.filter((g) => g.name === name)).toHaveLength(1);
      const mappings = (await (
        await bootstrap('GET', `/${realm}/groups/${found[0]?.id ?? ''}/role-mappings`)
      ).json()) as {
        clientMappings?: Record<string, { mappings: { name: string }[] }>;
      };
      expect(mappings.clientMappings?.['tenantry-api']?.mappings.map((m) => m.name)).toEqual([role]);
    }
  });

  it('creates the console group (no role) and the console role (the query roles) once, and turns admin events on', async () => {
    await provisioner.ensureGroups(realm);
    const found = (await (
      await bootstrap('GET', `/${realm}/groups?search=tenantry-console&exact=true`)
    ).json()) as {
      id: string;
      name: string;
    }[];
    expect(found.filter((g) => g.name === 'tenantry-console')).toHaveLength(1);
    const mappings = (await (
      await bootstrap('GET', `/${realm}/groups/${found[0]?.id ?? ''}/role-mappings`)
    ).json()) as { clientMappings?: unknown };
    expect(mappings.clientMappings).toBeUndefined();
    const role = (await (await bootstrap('GET', `/${realm}/roles/tenantry-console-user`)).json()) as {
      id: string;
    };
    const parts = (await (await bootstrap('GET', `/${realm}/roles-by-id/${role.id}/composites`)).json()) as {
      name: string;
    }[];
    expect(parts.map((p) => p.name).sort()).toEqual(['query-groups', 'query-users']);
    // Not on everyone: a person holding realm-management roles is guarded like an admin (5a's SCIM breaks).
    const defaults = (await (await bootstrap('GET', `/${realm}/roles/default-roles-${realm}`)).json()) as {
      id: string;
    };
    const composites = (await (
      await bootstrap('GET', `/${realm}/roles-by-id/${defaults.id}/composites`)
    ).json()) as { name: string }[];
    expect(composites.map((c) => c.name)).not.toContain('query-users');
    const rep = (await (await bootstrap('GET', `/${realm}`)).json()) as Record<string, unknown>;
    expect(rep).toMatchObject({ adminEventsEnabled: true, adminEventsDetailsEnabled: true });
  });

  it('runs again without a refusal once admin permissions are on', async () => {
    await bootstrap('PUT', `/${realm}`, { adminPermissionsEnabled: true });
    const vars = testRealmVars(realm, 'Provisioner Test');
    await provisioner.applyTemplate(realm, loadRealmTemplate(TEMPLATE_VERSION, vars));
    await expect(provisioner.ensureClients(realm, loadProductClients(vars))).resolves.toBeUndefined();
    await expect(provisioner.ensureGroups(realm)).resolves.toBeUndefined();
  });
});

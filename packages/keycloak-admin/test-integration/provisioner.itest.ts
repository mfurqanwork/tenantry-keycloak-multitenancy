import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadProductClients, loadRealmTemplate, TEMPLATE_VERSION } from '../src/realms/templates.js';
import { mailsTo } from './mailpit.js';
import { bootstrap, testProvisioner, testRealmVars } from './stack.js';

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
});

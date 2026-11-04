import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DirectoryError } from './errors.js';
import { InMemoryIdentityDirectory } from './testing/in-memory-identity-directory.js';
import { runIdentityDirectoryContract } from './testing/contract.js';
import { InMemoryRealmMembers } from './testing/in-memory-realm-members.js';
import { runRealmMemberContract } from './testing/member-contract.js';
import { runRealmAppsContract } from './testing/apps-contract.js';
import { InMemoryRealmApps } from './testing/in-memory-realm-apps.js';
import { InMemoryRealmScim } from './testing/in-memory-realm-scim.js';
import { runRealmScimContract } from './testing/scim-contract.js';

runIdentityDirectoryContract('in-memory', () => {
  const dir = new InMemoryIdentityDirectory();
  return Promise.resolve({
    dir,
    newUser: () => Promise.resolve(randomUUID()),
    redirectUris: (app) => Promise.resolve([...dir.origins[app]].map((o) => `${o}/*`)),
    companyIssuer: 'http://corp.example/realms/corp-demo',
    orgDomains: (orgId) => Promise.resolve(dir.domainsOf(orgId)),
    cleanup: () => Promise.resolve(),
  });
});

describe('InMemoryIdentityDirectory', () => {
  it('fails the operation it is told to fail', async () => {
    const dir = new InMemoryIdentityDirectory();
    dir.failOn('createGroups');
    const { id } = await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await expect(dir.createGroups(id)).rejects.toBeInstanceOf(DirectoryError);
    dir.clearFailures();
    await expect(dir.createGroups(id)).resolves.toBeUndefined();
  });

  it('records invites and origins for assertions', async () => {
    const dir = new InMemoryIdentityDirectory();
    const { id } = await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await dir.inviteUser(id, 'bob@example.com');
    await dir.addTenantOrigin('http://acme.tenantry.localhost', 'web');
    expect(dir.invites).toEqual([{ orgId: id, email: 'bob@example.com' }]);
    expect(dir.origins.web.has('http://acme.tenantry.localhost')).toBe(true);
  });

  it('refuses a second organization with the same alias', async () => {
    const dir = new InMemoryIdentityDirectory();
    await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await expect(dir.createOrganization({ alias: 'acme', name: 'Again' })).rejects.toBeInstanceOf(
      DirectoryError,
    );
  });
});

runRealmMemberContract('in-memory realm', () => {
  const members = new InMemoryRealmMembers();
  return Promise.resolve({
    members,
    completeSignUp: (kcUserId: string) => {
      members.markSignedIn(kcUserId);
      return Promise.resolve();
    },
    emailsTo: (address: string) => Promise.resolve(members.emailsSent.filter((e) => e === address).length),
    cleanup: () => Promise.resolve(),
  });
});

runRealmAppsContract('in-memory', () => {
  const apps = new InMemoryRealmApps();
  return Promise.resolve({
    apps,
    productClientUuid: apps.productClientUuid,
    redirectUrisOf: (uuid) => Promise.resolve(apps.clients.get(uuid)?.spec.redirectUris ?? []),
    cleanup: () => Promise.resolve(),
  });
});

describe('InMemoryRealmApps', () => {
  it('fails the next call as told, with the detail Keycloak would give', async () => {
    const apps = new InMemoryRealmApps();
    apps.failNext(400, 'Invalid Redirect Uri');
    const failed = apps.create('app-00000000', {
      name: 'x',
      type: 'spa',
      redirectUris: ['https://x.test/cb'],
      postLogoutRedirectUris: [],
      webOrigins: [],
    });
    await expect(failed).rejects.toMatchObject({ status: 400, detail: 'Invalid Redirect Uri' });
    expect(apps.clients.size).toBe(1);
  });
});

runRealmScimContract('in-memory', () => {
  const scim = new InMemoryRealmScim();
  return Promise.resolve({
    scim,
    roleOf: (id) => Promise.resolve(scim.people.get(id)?.role ?? null),
    groupId: (name) => Promise.resolve(scim.groupNamed(name)),
    addToGroup: (id, name) => {
      scim.groups.get(scim.groupNamed(name))?.members.add(id);
      return Promise.resolve();
    },
    groupMembers: (name) => Promise.resolve([...(scim.groups.get(scim.groupNamed(name))?.members ?? [])]),
    cleanup: () => Promise.resolve(),
  });
});

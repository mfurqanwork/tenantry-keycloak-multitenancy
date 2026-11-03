import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DirectoryError } from './errors.js';
import { InMemoryIdentityDirectory } from './testing/in-memory-identity-directory.js';
import { runIdentityDirectoryContract } from './testing/contract.js';
import { InMemoryRealmMembers } from './testing/in-memory-realm-members.js';
import { runRealmMemberContract } from './testing/member-contract.js';

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

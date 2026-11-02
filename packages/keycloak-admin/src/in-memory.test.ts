import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DirectoryError } from './errors.js';
import { InMemoryIdentityDirectory } from './testing/in-memory-identity-directory.js';
import { runIdentityDirectoryContract } from './testing/contract.js';

runIdentityDirectoryContract('in-memory', () =>
  Promise.resolve({
    dir: new InMemoryIdentityDirectory(),
    newUser: () => Promise.resolve(randomUUID()),
    cleanup: () => Promise.resolve(),
  }),
);

describe('InMemoryIdentityDirectory', () => {
  it('fails the operation it is told to fail', async () => {
    const dir = new InMemoryIdentityDirectory();
    dir.failOn('createGroups');
    const { id } = await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await expect(dir.createGroups(id)).rejects.toBeInstanceOf(DirectoryError);
  });

  it('records invites and origins for assertions', async () => {
    const dir = new InMemoryIdentityDirectory();
    const { id } = await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await dir.inviteUser(id, 'bob@example.com');
    await dir.addTenantOrigin('http://acme.tenantry.localhost');
    expect(dir.invites).toEqual([{ orgId: id, email: 'bob@example.com' }]);
    expect(dir.origins.has('http://acme.tenantry.localhost')).toBe(true);
  });

  it('refuses a second organization with the same alias', async () => {
    const dir = new InMemoryIdentityDirectory();
    await dir.createOrganization({ alias: 'acme', name: 'Acme' });
    await expect(dir.createOrganization({ alias: 'acme', name: 'Again' })).rejects.toBeInstanceOf(
      DirectoryError,
    );
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IdentityDirectory } from '../identity-directory.js';

export interface ContractSubject {
  dir: IdentityDirectory;
  newUser(): Promise<string>;
  cleanup(): Promise<void>;
}

// One behaviour for every IdentityDirectory: the in-memory fake must not drift from Keycloak.
export function runIdentityDirectoryContract(name: string, make: () => Promise<ContractSubject>): void {
  describe(`IdentityDirectory contract: ${name}`, () => {
    let s: ContractSubject;
    let orgId: string;
    let user: string;

    beforeAll(async () => {
      s = await make();
      const alias = `c${randomUUID().slice(0, 8)}`;
      orgId = (await s.dir.createOrganization({ alias, name: alias })).id;
      await s.dir.createGroups(orgId);
      user = await s.newUser();
    });
    afterAll(async () => {
      await s.dir.deleteOrganization(orgId);
      await s.cleanup();
    });

    it('starts with no members', async () => {
      expect(await s.dir.listMembers(orgId)).toEqual([]);
    });

    it('lists a new member with no group', async () => {
      await s.dir.addMember(orgId, user);
      expect(await s.dir.listMembers(orgId)).toEqual([
        expect.objectContaining({ kcUserId: user, group: null }),
      ]);
    });

    it('keeps a member in exactly one group', async () => {
      await s.dir.setMemberGroup(orgId, user, 'admins');
      await s.dir.setMemberGroup(orgId, user, 'members');
      expect(await s.dir.listMembers(orgId)).toEqual([
        expect.objectContaining({ kcUserId: user, group: 'members' }),
      ]);
    });

    it('accepts an invite for an email', async () => {
      await expect(
        s.dir.inviteUser(orgId, `invite-${randomUUID().slice(0, 8)}@example.com`),
      ).resolves.toBeUndefined();
    });

    it('removes a member', async () => {
      await s.dir.removeMember(orgId, user);
      expect(await s.dir.listMembers(orgId)).toEqual([]);
    });

    it('registers and removes a tenant origin, idempotently', async () => {
      const origin = `http://x${randomUUID().slice(0, 8)}.tenantry.localhost:8080`;
      await s.dir.addTenantOrigin(origin);
      await s.dir.addTenantOrigin(origin);
      await s.dir.removeTenantOrigin(origin);
      await expect(s.dir.removeTenantOrigin(origin)).resolves.toBeUndefined();
    });

    it('refuses a second organization with the same name, as Keycloak does', async () => {
      const name = `n${randomUUID().slice(0, 8)}`;
      const first = await s.dir.createOrganization({ alias: `a${name}`, name });
      await expect(s.dir.createOrganization({ alias: `b${name}`, name })).rejects.toThrow(/409/);
      await s.dir.deleteOrganization(first.id);
    });

    it('finds an organization by alias, and nothing for an unknown one', async () => {
      const alias = `f${randomUUID().slice(0, 8)}`;
      const { id } = await s.dir.createOrganization({ alias, name: alias });
      expect(await s.dir.findOrganizationByAlias(alias)).toEqual({ id });
      expect(await s.dir.findOrganizationByAlias(`${alias}x`)).toBeNull();
      await s.dir.deleteOrganization(id);
    });

    it('treats deleting a missing organization as done', async () => {
      const alias = `d${randomUUID().slice(0, 8)}`;
      const { id } = await s.dir.createOrganization({ alias, name: alias });
      await s.dir.deleteOrganization(id);
      await expect(s.dir.deleteOrganization(id)).resolves.toBeUndefined();
    });
  });
}

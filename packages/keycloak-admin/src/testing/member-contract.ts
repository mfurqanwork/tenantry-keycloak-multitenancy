import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MemberDirectory } from '../member-directory.js';

export interface MemberContractSubject {
  members: MemberDirectory;
  // Marks a user as having signed in (set a password), as a real person would.
  completeSignUp(kcUserId: string): Promise<void>;
  // How many set-password emails went to this address.
  emailsTo(address: string): Promise<number>;
  // Puts the person in, or takes them out of, a directory group that gives a role (SCIM, Phase 5a).
  joinGroup(kcUserId: string, group: 'tenantry-members' | 'tenantry-admins'): Promise<void>;
  leaveGroup(kcUserId: string, group: 'tenantry-members' | 'tenantry-admins'): Promise<void>;
  cleanup(): Promise<void>;
}

// One behaviour for every Enterprise member directory: the in-memory fake must not drift from Keycloak.
export function runRealmMemberContract(name: string, make: () => Promise<MemberContractSubject>): void {
  describe(`Enterprise member directory contract: ${name}`, () => {
    let s: MemberContractSubject;
    const email = () => `m-${randomUUID().slice(0, 8)}@example.test`;

    beforeAll(async () => {
      s = await make();
    });
    afterAll(async () => {
      await s.cleanup();
    });

    it('lists an invitee at once with the role given', async () => {
      const address = email();
      const { kcUserId } = await s.members.invite(address, 'admin');
      expect(kcUserId).toBeTruthy();
      expect(await s.members.listMembers()).toContainEqual(
        expect.objectContaining({ kcUserId, email: address, role: 'admin' }),
      );
    });

    it('gives an existing person the role without a second account', async () => {
      const address = email();
      const first = await s.members.invite(address, 'member');
      const again = await s.members.invite(address, 'admin');
      expect(again.kcUserId).toBe(first.kcUserId);
      const matches = (await s.members.listMembers()).filter((m) => m.email === address);
      expect(matches).toEqual([expect.objectContaining({ role: 'admin' })]);
    });

    it('sends the set-password email again while an invitee has no password, and not after', async () => {
      const pending = email();
      await s.members.invite(pending, 'member');
      await s.members.invite(pending, 'admin');
      expect(await s.emailsTo(pending)).toBe(2);
      const active = email();
      const { kcUserId } = await s.members.invite(active, 'member');
      await s.completeSignUp(kcUserId ?? '');
      await s.members.invite(active, 'admin');
      expect(await s.emailsTo(active)).toBe(1);
    });

    it('keeps a member in exactly one role', async () => {
      const { kcUserId } = await s.members.invite(email(), 'member');
      await s.members.setRole(kcUserId ?? '', 'owner');
      await s.members.setRole(kcUserId ?? '', 'admin');
      const found = (await s.members.listMembers()).find((m) => m.kcUserId === kcUserId);
      expect(found?.role).toBe('admin');
    });

    it('removes a member, who is then not listed', async () => {
      const { kcUserId } = await s.members.invite(email(), 'member');
      await s.members.remove(kcUserId ?? '');
      expect((await s.members.listMembers()).some((m) => m.kcUserId === kcUserId)).toBe(false);
    });

    it('deletes an unused invitee, but never someone who has signed in', async () => {
      const unused = await s.members.invite(email(), 'member');
      expect(await s.members.deleteUnusedUser(unused.kcUserId ?? '')).toBe(true);
      const used = await s.members.invite(email(), 'member');
      await s.completeSignUp(used.kcUserId ?? '');
      expect(await s.members.deleteUnusedUser(used.kcUserId ?? '')).toBe(false);
      expect((await s.members.listMembers()).some((m) => m.kcUserId === used.kcUserId)).toBe(true);
    });

    it('lists people who hold a role through a mapped group, the higher role winning', async () => {
      const address = email();
      const kcUserId = (await s.members.invite(address, 'member')).kcUserId ?? '';
      await s.joinGroup(kcUserId, 'tenantry-admins');
      expect((await s.members.listMembers()).find((m) => m.kcUserId === kcUserId)?.role).toBe('admin');
      await s.leaveGroup(kcUserId, 'tenantry-admins');
      expect((await s.members.listMembers()).find((m) => m.kcUserId === kcUserId)?.role).toBe('member');
    });
  });
}

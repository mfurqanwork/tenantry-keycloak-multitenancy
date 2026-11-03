import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MemberDirectory } from '../member-directory.js';

export interface MemberContractSubject {
  members: MemberDirectory;
  // Marks a user as having signed in (set a password), as a real person would.
  completeSignUp(kcUserId: string): Promise<void>;
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
  });
}

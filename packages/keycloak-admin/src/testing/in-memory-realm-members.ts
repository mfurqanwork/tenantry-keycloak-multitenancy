import { randomUUID } from 'node:crypto';
import { highestRole, type Role } from '@tenantry/auth';
import { DirectoryError } from '../errors.js';
import type { Member } from '../member-directory.js';
import type { RealmMembers } from '../realms/realm-members.js';
import { MAPPED_GROUPS } from '../realms/templates.js';

interface FakeUser {
  email: string;
  role: Role | null;
  signedIn: boolean;
  emailVerified?: boolean;
}

// An enterprise realm's members for unit tests. The member contract keeps it honest against Keycloak.
export class InMemoryRealmMembers implements RealmMembers {
  readonly users = new Map<string, FakeUser>();
  readonly emailsSent: string[] = [];
  // Directory groups (SCIM) each person is in.
  readonly groupsOf = new Map<string, Set<keyof typeof MAPPED_GROUPS>>();
  private readonly failing = new Set<keyof RealmMembers>();

  failOn(operation: keyof RealmMembers): void {
    this.failing.add(operation);
  }

  // A direct role and the roles of the person's mapped groups: the highest one counts.
  private roleOf(kcUserId: string, direct: Role | null): Role | null {
    const viaGroups = [...(this.groupsOf.get(kcUserId) ?? [])].map((g) => MAPPED_GROUPS[g]);
    return highestRole([...(direct ? [direct] : []), ...viaGroups]);
  }

  joinGroup(kcUserId: string, group: keyof typeof MAPPED_GROUPS): void {
    const held = this.groupsOf.get(kcUserId) ?? new Set();
    held.add(group);
    this.groupsOf.set(kcUserId, held);
  }

  leaveGroup(kcUserId: string, group: keyof typeof MAPPED_GROUPS): void {
    this.groupsOf.get(kcUserId)?.delete(group);
  }

  // Tests: the person set their password and signed in.
  markSignedIn(kcUserId: string): void {
    const user = this.users.get(kcUserId);
    if (user) user.signedIn = true;
  }

  private run<T>(operation: keyof RealmMembers, fn: () => T): Promise<T> {
    return Promise.resolve().then(() => {
      if (this.failing.has(operation)) throw new DirectoryError(operation, 500, 'injected failure');
      return fn();
    });
  }

  private user(operation: string, kcUserId: string): FakeUser {
    const user = this.users.get(kcUserId);
    if (!user) throw new DirectoryError(operation, 404);
    return user;
  }

  listMembers(): Promise<Member[]> {
    return this.run('listMembers', () =>
      [...this.users]
        .map(([kcUserId, u]) => ({
          kcUserId,
          email: u.email,
          displayName: null,
          role: this.roleOf(kcUserId, u.role),
        }))
        .filter((m) => m.role !== null),
    );
  }

  importMember(input: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: Role | null;
  }): Promise<{ kcUserId: string; created: boolean }> {
    return this.run('importMember', () => {
      const address = input.email.toLowerCase();
      const existing = [...this.users].find(([, u]) => u.email === address);
      if (existing) {
        if (input.role) existing[1].role = input.role;
        return { kcUserId: existing[0], created: false };
      }
      const kcUserId = randomUUID();
      this.users.set(kcUserId, { email: address, role: input.role, signedIn: false, emailVerified: true });
      return { kcUserId, created: true };
    });
  }

  invite(email: string, role: Role): Promise<{ kcUserId: string }> {
    return this.run('invite', () => {
      const existing = [...this.users].find(([, u]) => u.email === email.toLowerCase());
      if (existing) {
        existing[1].role = role;
        if (!existing[1].signedIn) this.emailsSent.push(email.toLowerCase());
        return { kcUserId: existing[0] };
      }
      const kcUserId = randomUUID();
      this.users.set(kcUserId, { email: email.toLowerCase(), role, signedIn: false });
      this.emailsSent.push(email);
      return { kcUserId };
    });
  }

  setRole(kcUserId: string, role: Role): Promise<void> {
    return this.run('setRole', () => {
      this.user('setRole', kcUserId).role = role;
    });
  }

  remove(kcUserId: string): Promise<void> {
    return this.run('remove', () => {
      this.user('remove', kcUserId).role = null;
    });
  }

  deleteUnusedUser(kcUserId: string): Promise<boolean> {
    return this.run('deleteUnusedUser', () => {
      const user = this.users.get(kcUserId);
      if (!user || user.signedIn) return false;
      this.users.delete(kcUserId);
      return true;
    });
  }
}

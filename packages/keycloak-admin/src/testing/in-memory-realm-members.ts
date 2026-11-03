import { randomUUID } from 'node:crypto';
import type { Role } from '@tenantry/auth';
import { DirectoryError } from '../errors.js';
import type { Member, MemberDirectory } from '../member-directory.js';

interface FakeUser {
  email: string;
  role: Role | null;
  signedIn: boolean;
}

// An enterprise realm's members for unit tests. The member contract keeps it honest against Keycloak.
export class InMemoryRealmMembers implements MemberDirectory {
  readonly users = new Map<string, FakeUser>();
  readonly emailsSent: string[] = [];
  private readonly failing = new Set<keyof MemberDirectory>();

  failOn(operation: keyof MemberDirectory): void {
    this.failing.add(operation);
  }

  // Tests: the person set their password and signed in.
  markSignedIn(kcUserId: string): void {
    const user = this.users.get(kcUserId);
    if (user) user.signedIn = true;
  }

  private run<T>(operation: keyof MemberDirectory, fn: () => T): Promise<T> {
    return Promise.resolve().then(() => {
      if (this.failing.has(operation)) throw new DirectoryError(operation, 500, 'injected failure');
      return fn();
    });
  }

  private user(operation: keyof MemberDirectory, kcUserId: string): FakeUser {
    const user = this.users.get(kcUserId);
    if (!user) throw new DirectoryError(operation, 404);
    return user;
  }

  listMembers(): Promise<Member[]> {
    return this.run('listMembers', () =>
      [...this.users]
        .filter(([, u]) => u.role !== null)
        .map(([kcUserId, u]) => ({ kcUserId, email: u.email, displayName: null, role: u.role })),
    );
  }

  invite(email: string, role: Role): Promise<{ kcUserId: string }> {
    return this.run('invite', () => {
      const existing = [...this.users].find(([, u]) => u.email === email.toLowerCase());
      if (existing) {
        existing[1].role = role;
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

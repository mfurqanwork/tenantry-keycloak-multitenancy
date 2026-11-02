import { randomUUID } from 'node:crypto';
import type { GroupName } from '@tenantry/auth';
import { DirectoryError } from '../errors.js';
import type { DirectoryMember, IdentityDirectory } from '../identity-directory.js';

interface Org {
  alias: string;
  name: string;
  groups: boolean;
  members: Map<string, GroupName | null>;
}

// A Keycloak stand-in for unit tests. The contract test keeps it honest against the real server.
export class InMemoryIdentityDirectory implements IdentityDirectory {
  readonly orgs = new Map<string, Org>();
  readonly origins = new Set<string>();
  readonly invites: { orgId: string; email: string }[] = [];
  // Profiles for listMembers; tests register users they create.
  readonly users = new Map<string, { email: string | null; displayName: string | null }>();
  private readonly failing = new Set<keyof IdentityDirectory>();

  failOn(operation: keyof IdentityDirectory): void {
    this.failing.add(operation);
  }

  clearFailures(): void {
    this.failing.clear();
  }

  // Like the real client, every failure is a rejected promise, never a synchronous throw.
  private run<T>(operation: keyof IdentityDirectory, fn: () => T): Promise<T> {
    return new Promise((resolve) => {
      if (this.failing.has(operation)) throw new DirectoryError(operation, 500, 'injected failure');
      resolve(fn());
    });
  }

  private org(operation: keyof IdentityDirectory, orgId: string): Org {
    const org = this.orgs.get(orgId);
    if (!org) throw new DirectoryError(operation, 404);
    return org;
  }

  createOrganization(input: { alias: string; name: string }): Promise<{ id: string }> {
    return this.run('createOrganization', () => {
      if ([...this.orgs.values()].some((o) => o.alias === input.alias)) {
        throw new DirectoryError('createOrganization', 409);
      }
      const id = randomUUID();
      this.orgs.set(id, { ...input, groups: false, members: new Map() });
      return { id };
    });
  }

  deleteOrganization(orgId: string): Promise<void> {
    return this.run('deleteOrganization', () => {
      this.orgs.delete(orgId);
      return undefined;
    });
  }

  createGroups(orgId: string): Promise<void> {
    return this.run('createGroups', () => {
      this.org('createGroups', orgId).groups = true;
      return undefined;
    });
  }

  addMember(orgId: string, kcUserId: string): Promise<void> {
    return this.run('addMember', () => {
      const members = this.org('addMember', orgId).members;
      if (!members.has(kcUserId)) members.set(kcUserId, null);
      return undefined;
    });
  }

  removeMember(orgId: string, kcUserId: string): Promise<void> {
    return this.run('removeMember', () => {
      this.org('removeMember', orgId).members.delete(kcUserId);
      return undefined;
    });
  }

  setMemberGroup(orgId: string, kcUserId: string, group: GroupName): Promise<void> {
    return this.run('setMemberGroup', () => {
      const org = this.org('setMemberGroup', orgId);
      if (!org.groups) throw new DirectoryError('setMemberGroup', 404, 'groups missing');
      if (!org.members.has(kcUserId)) throw new DirectoryError('setMemberGroup', 404, 'not a member');
      org.members.set(kcUserId, group);
      return undefined;
    });
  }

  listMembers(orgId: string): Promise<DirectoryMember[]> {
    return this.run('listMembers', () => {
      const members = [...this.org('listMembers', orgId).members].map(([kcUserId, group]) => ({
        kcUserId,
        email: this.users.get(kcUserId)?.email ?? null,
        displayName: this.users.get(kcUserId)?.displayName ?? null,
        group,
      }));
      return members;
    });
  }

  inviteUser(orgId: string, email: string): Promise<void> {
    return this.run('inviteUser', () => {
      this.org('inviteUser', orgId);
      this.invites.push({ orgId, email });
      return undefined;
    });
  }

  addTenantOrigin(origin: string): Promise<void> {
    return this.run('addTenantOrigin', () => {
      this.origins.add(origin);
      return undefined;
    });
  }

  removeTenantOrigin(origin: string): Promise<void> {
    return this.run('removeTenantOrigin', () => {
      this.origins.delete(origin);
      return undefined;
    });
  }
}

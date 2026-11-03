import { randomUUID } from 'node:crypto';
import type { GroupName, TenantApp } from '@tenantry/auth';
import { DirectoryError } from '../errors.js';
import type { CompanyIdentityProvider, DirectoryMember, IdentityDirectory } from '../identity-directory.js';

interface Org {
  alias: string;
  name: string;
  // Domain name → the identity provider that signs it in.
  domains: Map<string, string | null>;
  idps: Set<string>;
  groups: boolean;
  members: Map<string, GroupName | null>;
}

// A Keycloak stand-in for unit tests. The contract test keeps it honest against the real server.
export class InMemoryIdentityDirectory implements IdentityDirectory {
  readonly orgs = new Map<string, Org>();
  readonly origins: Record<TenantApp, Set<string>> = { web: new Set(), portal: new Set() };
  readonly invites: { orgId: string; email: string }[] = [];
  readonly identityProviders = new Map<string, { issuer: string; clientId: string }>();
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
  // Milliseconds each call waits before it runs, like a network round trip; lets tests interleave calls.
  latencyMs = 0;

  private run<T>(operation: keyof IdentityDirectory, fn: () => T): Promise<T> {
    const wait = new Promise<void>((resolve) => {
      if (this.latencyMs > 0) setTimeout(resolve, this.latencyMs);
      else resolve();
    });
    return wait.then(() => {
      if (this.failing.has(operation)) throw new DirectoryError(operation, 500, 'injected failure');
      return fn();
    });
  }

  private org(operation: keyof IdentityDirectory, orgId: string): Org {
    const org = this.orgs.get(orgId);
    if (!org) throw new DirectoryError(operation, 404);
    return org;
  }

  createOrganization(input: { alias: string; name: string }): Promise<{ id: string }> {
    return this.run('createOrganization', () => {
      // Keycloak keeps both the alias and the name unique.
      if ([...this.orgs.values()].some((o) => o.alias === input.alias || o.name === input.name)) {
        throw new DirectoryError('createOrganization', 409);
      }
      const id = randomUUID();
      this.orgs.set(id, { ...input, groups: false, members: new Map(), domains: new Map(), idps: new Set() });
      return { id };
    });
  }

  findOrganizationByAlias(alias: string): Promise<{ id: string } | null> {
    return this.run('findOrganizationByAlias', () => {
      const found = [...this.orgs].find(([, org]) => org.alias === alias);
      return found ? { id: found[0] } : null;
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

  listUserOrganizations(kcUserId: string): Promise<{ id: string; alias: string; name: string }[]> {
    return this.run('listUserOrganizations', () =>
      [...this.orgs.entries()]
        .filter(([, o]) => o.members.has(kcUserId))
        .map(([id, o]) => ({ id, alias: o.alias, name: o.name })),
    );
  }

  inviteUser(orgId: string, email: string): Promise<void> {
    return this.run('inviteUser', () => {
      this.org('inviteUser', orgId);
      this.invites.push({ orgId, email });
      return undefined;
    });
  }

  addTenantOrigin(origin: string, app: TenantApp): Promise<void> {
    return this.run('addTenantOrigin', () => {
      this.origins[app].add(origin);
      return undefined;
    });
  }

  // For assertions: an organization's domains and the provider linked to each.
  domainsOf(orgId: string): { name: string; identityProviderAlias: string | null }[] {
    const found = this.orgs.get(orgId);
    return found
      ? [...found.domains].map(([name, identityProviderAlias]) => ({ name, identityProviderAlias }))
      : [];
  }

  addOrganizationDomain(orgId: string, domain: string): Promise<void> {
    return this.run('addOrganizationDomain', () => {
      const org = this.org('addOrganizationDomain', orgId);
      if (!org.domains.has(domain)) org.domains.set(domain, null);
      return undefined;
    });
  }

  createOidcIdentityProvider(input: CompanyIdentityProvider): Promise<void> {
    return this.run('createOidcIdentityProvider', () => {
      if (!this.identityProviders.has(input.alias)) {
        this.identityProviders.set(input.alias, { issuer: input.issuer, clientId: input.clientId });
      }
      return undefined;
    });
  }

  linkIdentityProvider(orgId: string, alias: string, domain: string): Promise<void> {
    return this.run('linkIdentityProvider', () => {
      const org = this.org('linkIdentityProvider', orgId);
      if (!this.identityProviders.has(alias)) throw new DirectoryError('linkIdentityProvider', 404);
      if (!org.domains.has(domain))
        throw new DirectoryError('linkIdentityProvider', 400, `no domain ${domain}`);
      org.idps.add(alias);
      org.domains.set(domain, alias);
      return undefined;
    });
  }

  deleteIdentityProvider(alias: string): Promise<void> {
    return this.run('deleteIdentityProvider', () => {
      this.identityProviders.delete(alias);
      for (const org of this.orgs.values()) {
        org.idps.delete(alias);
        for (const [name, linked] of org.domains) if (linked === alias) org.domains.set(name, null);
      }
      return undefined;
    });
  }

  removeTenantOrigin(origin: string, app: TenantApp): Promise<void> {
    return this.run('removeTenantOrigin', () => {
      this.origins[app].delete(origin);
      return undefined;
    });
  }
}

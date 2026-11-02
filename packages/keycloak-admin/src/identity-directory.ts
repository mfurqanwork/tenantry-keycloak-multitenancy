import type { GroupName } from '@tenantry/auth';

export type { GroupName } from '@tenantry/auth';

export interface DirectoryMember {
  kcUserId: string;
  email: string | null;
  displayName: string | null;
  group: GroupName | null;
}

// Everything the API asks of Keycloak for Standard tenants. Services depend on this, never on HTTP.
export interface IdentityDirectory {
  createOrganization(input: { alias: string; name: string }): Promise<{ id: string }>;
  findOrganizationByAlias(alias: string): Promise<{ id: string } | null>;
  // A missing organization counts as deleted.
  deleteOrganization(orgId: string): Promise<void>;
  // Creates the owners, admins and members groups inside the organization.
  createGroups(orgId: string): Promise<void>;
  addMember(orgId: string, kcUserId: string): Promise<void>;
  removeMember(orgId: string, kcUserId: string): Promise<void>;
  // Puts the member in this group and takes them out of the other two.
  setMemberGroup(orgId: string, kcUserId: string, group: GroupName): Promise<void>;
  listMembers(orgId: string): Promise<DirectoryMember[]>;
  inviteUser(orgId: string, email: string): Promise<void>;
  // Adds `${origin}/*` to tenantry-web's redirect URIs and the origin to its web origins. Idempotent.
  addTenantOrigin(origin: string): Promise<void>;
  removeTenantOrigin(origin: string): Promise<void>;
}

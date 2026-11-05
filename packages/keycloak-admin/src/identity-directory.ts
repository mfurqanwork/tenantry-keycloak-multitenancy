import type { GroupName, TenantApp } from '@tenantry/auth';

export type { GroupName, TenantApp } from '@tenantry/auth';

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
  // Every organization the user is a member of, whatever their group.
  listUserOrganizations(kcUserId: string): Promise<{ id: string; alias: string; name: string }[]>;
  inviteUser(orgId: string, email: string): Promise<void>;
  // Adds `${origin}/*` to the app's client (tenantry-web or tenantry-portal): redirect URIs and web
  // origins. Idempotent.
  addTenantOrigin(origin: string, app: TenantApp): Promise<void>;
  removeTenantOrigin(origin: string, app: TenantApp): Promise<void>;

  // Company login (ADR-0022), used by the operator scripts only.
  // Adds a verified email domain to the organization. Idempotent.
  addOrganizationDomain(orgId: string, domain: string): Promise<void>;
  // An OIDC identity provider in the realm, configured from the issuer's discovery document. When the
  // alias exists already, nothing changes and `created` is false, so callers never undo what they did
  // not make.
  createOidcIdentityProvider(input: CompanyIdentityProvider): Promise<{ created: boolean }>;
  // Links the provider to the organization and makes it sign in that domain's people (Keycloak sends
  // them there by the email domain). The organization must already have the domain. Idempotent.
  linkIdentityProvider(orgId: string, alias: string, domain: string): Promise<void>;
  // A missing provider counts as deleted.
  deleteIdentityProvider(alias: string): Promise<void>;

  // Moving a workspace to Enterprise (ADR-0025): what the shared realm knows of a person, and the bridge.
  getUser(kcUserId: string): Promise<PlatformUser | null>;
  // The company logins (and the like) a person signed in through.
  listFederatedIdentities(kcUserId: string): Promise<FederatedIdentity[]>;
  // A company login's settings, without its secret: Keycloak never returns one.
  getIdentityProvider(alias: string): Promise<IdentityProviderSettings | null>;
  // The name on the provider's sign-in button; changes it only when it differs.
  setIdentityProviderDisplayName(alias: string, displayName: string): Promise<{ changed: boolean }>;
  // The confidential client tenantry-bridge-<slug> that the new realm's bridge signs in through.
  ensureBridgeClient(slug: string, redirectUri: string, secret: string): Promise<void>;
  // A missing client counts as deleted.
  deleteBridgeClient(slug: string): Promise<void>;
}

export interface PlatformUser {
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface FederatedIdentity {
  alias: string;
  userId: string;
  userName: string;
}

export interface IdentityProviderSettings {
  alias: string;
  issuer: string;
  clientId: string;
  // The name on its sign-in button; null when Keycloak shows the alias.
  displayName: string | null;
  // Keycloak's provider config with the secret taken out.
  config: Record<string, string>;
  mappers: { name: string; identityProviderMapper: string; config: Record<string, string> }[];
}

export const bridgeClientId = (slug: string) => `tenantry-bridge-${slug}`;

export interface CompanyIdentityProvider {
  alias: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  // The name on its sign-in button (Phase 6a); without one, Keycloak shows the alias.
  displayName?: string;
}

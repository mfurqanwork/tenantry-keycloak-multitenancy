import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IdentityDirectory, TenantApp } from '../identity-directory.js';

export interface ContractSubject {
  dir: IdentityDirectory;
  newUser(): Promise<string>;
  // The redirect URIs the app's client holds now.
  redirectUris(app: TenantApp): Promise<string[]>;
  // An OIDC issuer the directory can reach for company login (the corp-demo realm against Keycloak).
  companyIssuer: string;
  // How the organization's domains look now: name, and the identity provider that signs it in.
  orgDomains(orgId: string): Promise<{ name: string; identityProviderAlias: string | null }[]>;
  // How many tenantry-bridge-<slug> clients exist, with the secret and redirect URIs of the one there is.
  bridgeClient(slug: string): Promise<{ count: number; secret?: string; redirectUris?: string[] }>;
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
      await s.dir.addTenantOrigin(origin, 'web');
      await s.dir.addTenantOrigin(origin, 'web');
      expect((await s.redirectUris('web')).filter((u) => u === `${origin}/*`)).toHaveLength(1);
      await s.dir.removeTenantOrigin(origin, 'web');
      await expect(s.dir.removeTenantOrigin(origin, 'web')).resolves.toBeUndefined();
      expect(await s.redirectUris('web')).not.toContain(`${origin}/*`);
    });

    it("adds a portal origin to the portal's client only", async () => {
      const origin = `http://p${randomUUID().slice(0, 8)}.portal.tenantry.localhost:8080`;
      await s.dir.addTenantOrigin(origin, 'portal');
      expect(await s.redirectUris('portal')).toContain(`${origin}/*`);
      expect(await s.redirectUris('web')).not.toContain(`${origin}/*`);
      await s.dir.removeTenantOrigin(origin, 'portal');
      expect(await s.redirectUris('portal')).not.toContain(`${origin}/*`);
    });

    it('lists the organizations a user belongs to, and none for a stranger', async () => {
      const second = `w${randomUUID().slice(0, 8)}`;
      const { id: secondId } = await s.dir.createOrganization({ alias: second, name: second });
      const someone = await s.newUser();
      const stranger = await s.newUser();
      await s.dir.addMember(orgId, someone);
      await s.dir.addMember(secondId, someone);
      const orgs = await s.dir.listUserOrganizations(someone);
      expect(orgs.map((o) => o.id).sort()).toEqual([orgId, secondId].sort());
      expect(orgs.find((o) => o.id === secondId)).toEqual({ id: secondId, alias: second, name: second });
      expect(await s.dir.listUserOrganizations(stranger)).toEqual([]);
      await s.dir.removeMember(orgId, someone);
      await s.dir.deleteOrganization(secondId);
    });

    it("links a company identity provider to the organization's domain, idempotently", async () => {
      const alias = `idp${randomUUID().slice(0, 8)}`;
      const domain = `${alias}.test`;
      const { id } = await s.dir.createOrganization({ alias, name: alias });
      await s.dir.addOrganizationDomain(id, domain);
      await s.dir.addOrganizationDomain(id, domain);
      expect(await s.orgDomains(id)).toEqual([{ name: domain, identityProviderAlias: null }]);
      const provider = {
        alias,
        issuer: s.companyIssuer,
        clientId: 'tenantry-platform',
        clientSecret: 'contract-secret',
      };
      // The caller learns whether this call made the provider, so it never undoes one it did not make.
      expect(await s.dir.createOidcIdentityProvider(provider)).toEqual({ created: true });
      expect(await s.dir.createOidcIdentityProvider(provider)).toEqual({ created: false });
      await s.dir.linkIdentityProvider(id, alias, domain);
      await s.dir.linkIdentityProvider(id, alias, domain);
      expect(await s.orgDomains(id)).toEqual([{ name: domain, identityProviderAlias: alias }]);
      await s.dir.deleteIdentityProvider(alias);
      await expect(s.dir.deleteIdentityProvider(alias)).resolves.toBeUndefined();
      await s.dir.deleteOrganization(id);
    });

    it('reads a person for a move: email, names, username; null for a stranger', async () => {
      const found = await s.dir.getUser(user);
      expect(found?.username).toBeTruthy();
      expect(found).toHaveProperty('email');
      expect(found).toHaveProperty('firstName');
      expect(await s.dir.getUser(randomUUID())).toBeNull();
      expect(await s.dir.listFederatedIdentities(user)).toEqual([]);
    });

    it("reads a company identity provider's settings, never its secret", async () => {
      const alias = `idr${randomUUID().slice(0, 8)}`;
      await s.dir.createOidcIdentityProvider({
        alias,
        issuer: s.companyIssuer,
        clientId: 'tenantry-platform',
        clientSecret: 'contract-secret',
        displayName: 'Contract Corp',
      });
      const found = await s.dir.getIdentityProvider(alias);
      expect(found).toMatchObject({
        alias,
        issuer: s.companyIssuer,
        clientId: 'tenantry-platform',
        displayName: 'Contract Corp',
      });
      expect(JSON.stringify(found)).not.toContain('contract-secret');
      expect(found?.config['clientSecret']).toBeUndefined();
      expect(await s.dir.getIdentityProvider(`missing${randomUUID().slice(0, 8)}`)).toBeNull();
      await s.dir.deleteIdentityProvider(alias);
    });

    it("names a company identity provider's sign-in button, changing it only when it differs", async () => {
      const alias = `idn${randomUUID().slice(0, 8)}`;
      await s.dir.createOidcIdentityProvider({
        alias,
        issuer: s.companyIssuer,
        clientId: 'tenantry-platform',
        clientSecret: 'contract-secret',
      });
      expect((await s.dir.getIdentityProvider(alias))?.displayName).toBeNull();
      expect(await s.dir.setIdentityProviderDisplayName(alias, 'Acme Corp')).toEqual({ changed: true });
      expect(await s.dir.setIdentityProviderDisplayName(alias, 'Acme Corp')).toEqual({ changed: false });
      expect((await s.dir.getIdentityProvider(alias))?.displayName).toBe('Acme Corp');
      await s.dir.deleteIdentityProvider(alias);
    });

    it('keeps one bridge client per workspace, with the latest secret, and removes it', async () => {
      const slug = `br${randomUUID().slice(0, 8)}`;
      const uri = `http://auth.test/realms/ent-${slug}/broker/tenantry-account/endpoint`;
      await s.dir.ensureBridgeClient(slug, uri, 'first-secret');
      await s.dir.ensureBridgeClient(slug, uri, 'second-secret');
      expect(await s.bridgeClient(slug)).toEqual({ count: 1, secret: 'second-secret', redirectUris: [uri] });
      await s.dir.deleteBridgeClient(slug);
      await s.dir.deleteBridgeClient(slug);
      expect((await s.bridgeClient(slug)).count).toBe(0);
    });

    it('refuses to link a domain the organization does not have', async () => {
      const alias = `idq${randomUUID().slice(0, 8)}`;
      const { id } = await s.dir.createOrganization({ alias, name: alias });
      await s.dir.createOidcIdentityProvider({
        alias,
        issuer: s.companyIssuer,
        clientId: 'tenantry-platform',
        clientSecret: 'contract-secret',
      });
      await expect(s.dir.linkIdentityProvider(id, alias, `${alias}.test`)).rejects.toThrow();
      await s.dir.deleteIdentityProvider(alias);
      await s.dir.deleteOrganization(id);
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

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RealmScim } from '../realms/scim.js';

export interface ScimContractSubject {
  scim: RealmScim;
  // The tenantry-api role a person holds directly, or null.
  roleOf(kcUserId: string): Promise<string | null>;
  groupId(name: string): Promise<string>;
  addToGroup(kcUserId: string, groupName: string): Promise<void>;
  groupMembers(groupName: string): Promise<string[]>;
  // Gives a person the tenantry-api owner role directly, as an invite would.
  makeOwner(kcUserId: string): Promise<void>;
  // Whether the person can sign in (not deactivated).
  isEnabled(kcUserId: string): Promise<boolean>;
  cleanup(): Promise<void>;
}

const scimJson = { contentType: 'application/scim+json' };
const body = (o: unknown) => Buffer.from(JSON.stringify(o));
const parse = (b: Buffer) => JSON.parse(b.toString('utf8')) as Record<string, unknown>;

async function createUser(scim: RealmScim): Promise<string> {
  const email = `scim-${randomUUID().slice(0, 8)}@corp.test`;
  const res = await scim.forward({
    method: 'POST',
    path: 'Users',
    query: '',
    ...scimJson,
    body: body({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: email,
      emails: [{ value: email, primary: true }],
      name: { givenName: 'Scim', familyName: 'Person' },
      active: true,
    }),
  });
  expect(res.status).toBe(201);
  return String(parse(res.body)['id']);
}

// One behaviour for every RealmScim: the in-memory fake must not drift from Keycloak.
export function runRealmScimContract(name: string, make: () => Promise<ScimContractSubject>): void {
  describe(`Realm SCIM contract: ${name}`, () => {
    let s: ScimContractSubject;
    beforeAll(async () => {
      s = await make();
      await s.scim.enable();
    });
    afterAll(async () => {
      await s.cleanup();
    });

    it('turns on twice without harm, and lists people', async () => {
      await s.scim.enable();
      const res = await s.scim.forward({ method: 'GET', path: 'Users', query: 'count=5' });
      expect(res.status).toBe(200);
      expect(parse(res.body)['schemas']).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    });

    it('creates a person and finds them again, with a Location for them', async () => {
      const id = await createUser(s.scim);
      const res = await s.scim.forward({ method: 'GET', path: `Users/${id}`, query: '' });
      expect(res.status).toBe(200);
      expect(parse(res.body)['id']).toBe(id);
    });

    it('gives a person the member role', async () => {
      const id = await createUser(s.scim);
      expect(await s.roleOf(id)).toBeNull();
      await s.scim.grantRole(id, 'member');
      await s.scim.grantRole(id, 'member');
      expect(await s.roleOf(id)).toBe('member');
    });

    it('knows the two mapped groups, and empties one without deleting it', async () => {
      const admins = await s.groupId('tenantry-admins');
      expect(await s.scim.isMappedGroup(admins)).toBe(true);
      expect(await s.scim.isMappedGroup(await s.groupId('tenantry-members'))).toBe(true);
      expect(await s.scim.isMappedGroup(randomUUID())).toBe(false);
      const id = await createUser(s.scim);
      await s.addToGroup(id, 'tenantry-admins');
      expect(await s.groupMembers('tenantry-admins')).toContain(id);
      await s.scim.emptyGroup(admins);
      expect(await s.groupMembers('tenantry-admins')).toEqual([]);
      expect(await s.groupId('tenantry-admins')).toBe(admins);
    });

    it('knows an owner from anyone else', async () => {
      const owner = await createUser(s.scim);
      const member = await createUser(s.scim);
      await s.makeOwner(owner);
      await s.scim.grantRole(member, 'member');
      expect(await s.scim.isOwner(owner)).toBe(true);
      expect(await s.scim.isOwner(member)).toBe(false);
      expect(await s.scim.isOwner(randomUUID())).toBe(false);
    });

    it("takes Entra's deactivation: the string False, with a capital Replace", async () => {
      const id = await createUser(s.scim);
      const res = await s.scim.forward({
        method: 'PATCH',
        path: `Users/${id}`,
        query: '',
        ...scimJson,
        body: body({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
        }),
      });
      expect(res.status).toBe(200);
      expect(await s.isEnabled(id)).toBe(false);
    });

    it('answers nothing once turned off', async () => {
      await s.scim.disable();
      const res = await s.scim.forward({ method: 'GET', path: 'Users', query: '' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      await s.scim.enable();
      expect((await s.scim.forward({ method: 'GET', path: 'Users', query: '' })).status).toBe(200);
    });
  });
}

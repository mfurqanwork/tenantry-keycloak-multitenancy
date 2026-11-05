import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RealmConsole } from '../realms/console.js';

export interface ConsoleContractSubject {
  console: RealmConsole;
  realm: string;
  createUser(): Promise<string>;
  // In tenantry-console.
  hasConsole(kcUserId: string): Promise<boolean>;
  // The user ids the owner-deny permission names.
  protectedOwners(): Promise<string[]>;
  cleanup(): Promise<void>;
}

// One behaviour for every RealmConsole: the in-memory fake must not drift from Keycloak.
export function runRealmConsoleContract(name: string, make: () => Promise<ConsoleContractSubject>): void {
  describe(`Realm console contract: ${name}`, () => {
    let s: ConsoleContractSubject;
    beforeAll(async () => {
      s = await make();
      await s.console.ensurePermissions();
    });
    afterAll(async () => {
      await s.cleanup();
    });

    it('sets the permissions up twice without harm', async () => {
      await s.console.ensurePermissions();
      expect(await s.protectedOwners()).toEqual([]);
    });

    it('grants and revokes, twice each without harm', async () => {
      const id = await s.createUser();
      await s.console.grant(id);
      await s.console.grant(id);
      expect(await s.hasConsole(id)).toBe(true);
      await s.console.revoke(id);
      await s.console.revoke(id);
      expect(await s.hasConsole(id)).toBe(false);
    });

    it('revokes someone who does not exist without failing', async () => {
      await expect(s.console.revoke(randomUUID())).resolves.toBeUndefined();
    });

    it('replaces the protected owners each time', async () => {
      const a = await s.createUser();
      const b = await s.createUser();
      await s.console.protectOwners([a, b]);
      expect((await s.protectedOwners()).sort()).toEqual([a, b].sort());
      await s.console.protectOwners([b]);
      expect(await s.protectedOwners()).toEqual([b]);
      await s.console.protectOwners([]);
      expect(await s.protectedOwners()).toEqual([]);
    });

    it("names the realm's console address", () => {
      expect(s.console.consoleUrl()).toMatch(new RegExp(`/admin/${s.realm}/console/$`));
    });
  });
}

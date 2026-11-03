import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DirectoryError } from '../errors.js';
import type { AppClientSpec } from '../realms/app-clients.js';
import { newAppClientId } from '../realms/app-clients.js';
import { AppClientMissingError, type RealmApps } from '../realms/realm-apps.js';

export interface AppsContractSubject {
  apps: RealmApps;
  // One of our product clients (tenantry-web): never a customer app.
  productClientUuid: string;
  redirectUrisOf(kcClientUuid: string): Promise<string[]>;
  cleanup(): Promise<void>;
}

const spec = (type: AppClientSpec['type']): AppClientSpec => ({
  name: `Contract ${type}`,
  type,
  redirectUris: type === 'm2m' ? [] : ['https://hr.contract.test/callback'],
  postLogoutRedirectUris: [],
  webOrigins: [],
});

// One behaviour for every RealmApps: the in-memory fake must not drift from Keycloak.
export function runRealmAppsContract(name: string, make: () => Promise<AppsContractSubject>): void {
  describe(`Realm apps contract: ${name}`, () => {
    let s: AppsContractSubject;
    beforeAll(async () => {
      s = await make();
    });
    afterAll(async () => {
      await s.cleanup();
    });

    it('creates each type, with a secret only for confidential clients', async () => {
      for (const type of ['web', 'spa', 'native', 'm2m'] as const) {
        const created = await s.apps.create(newAppClientId(), spec(type));
        expect(created.kcClientUuid).toBeTruthy();
        if (type === 'web' || type === 'm2m') expect(created.secret).toEqual(expect.any(String));
        else expect(created.secret).toBeNull();
      }
    });

    it('checks client credentials, and rotation retires the old secret', async () => {
      const clientId = newAppClientId();
      const { kcClientUuid, secret } = await s.apps.create(clientId, spec('m2m'));
      expect(await s.apps.checkClientCredentials(clientId, secret ?? '')).toEqual({ ok: true });
      expect((await s.apps.checkClientCredentials(clientId, 'wrong')).ok).toBe(false);
      const next = await s.apps.rotateSecret(kcClientUuid);
      expect(next).not.toBe(secret);
      expect((await s.apps.checkClientCredentials(clientId, secret ?? '')).ok).toBe(false);
      expect(await s.apps.checkClientCredentials(clientId, next)).toEqual({ ok: true });
    });

    it('updates redirect URIs', async () => {
      const { kcClientUuid } = await s.apps.create(newAppClientId(), spec('spa'));
      await s.apps.update(kcClientUuid, { ...spec('spa'), redirectUris: ['https://new.contract.test/cb'] });
      expect(await s.redirectUrisOf(kcClientUuid)).toEqual(['https://new.contract.test/cb']);
    });

    it('removes a client, and removing it again is fine', async () => {
      const { kcClientUuid } = await s.apps.create(newAppClientId(), spec('web'));
      await s.apps.remove(kcClientUuid);
      await expect(s.apps.remove(kcClientUuid)).resolves.toBeUndefined();
      await expect(s.apps.update(kcClientUuid, spec('web'))).rejects.toBeInstanceOf(AppClientMissingError);
      await expect(s.apps.rotateSecret(kcClientUuid)).rejects.toBeInstanceOf(AppClientMissingError);
    });

    it('never touches a client that is not a customer app', async () => {
      await expect(s.apps.update(s.productClientUuid, spec('spa'))).rejects.toMatchObject({ status: 403 });
      await expect(s.apps.rotateSecret(s.productClientUuid)).rejects.toBeInstanceOf(DirectoryError);
      await expect(s.apps.remove(s.productClientUuid)).rejects.toMatchObject({ status: 403 });
    });
  });
}

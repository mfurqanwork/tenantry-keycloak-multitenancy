import type { RealmConsole } from '@tenantry/keycloak-admin';

export interface RealmConsoleFactory {
  forRealm(realm: string): RealmConsole;
}

// Console access to each enterprise realm (ADR-0026), through the provisioner account; one per realm, kept.
export function createRealmConsoleFactory(make: (realm: string) => RealmConsole): RealmConsoleFactory {
  const made = new Map<string, RealmConsole>();
  return {
    forRealm(realm) {
      let found = made.get(realm);
      if (!found) {
        found = make(realm);
        made.set(realm, found);
      }
      return found;
    },
  };
}

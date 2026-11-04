// One client per enterprise realm, made on first use and kept.
export interface ByRealm<T> {
  forRealm(realm: string): T;
}

export function byRealm<T>(make: (realm: string) => T): ByRealm<T> {
  const made = new Map<string, T>();
  return {
    forRealm(realm) {
      let found = made.get(realm);
      if (found === undefined) {
        found = make(realm);
        made.set(realm, found);
      }
      return found;
    },
  };
}

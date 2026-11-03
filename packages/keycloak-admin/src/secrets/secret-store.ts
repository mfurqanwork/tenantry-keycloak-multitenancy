// Where per-realm credentials live (ADR-0023): never Postgres, logs or audit metadata. Keys are
// "<realm>/<name>", for example "ent-initech/tenantry-backend".
export interface SecretStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const KEY = /^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/;

export function parseSecretKey(key: string): { realm: string; name: string } {
  const m = KEY.exec(key);
  if (!m?.[1] || !m[2]) throw new Error(`Bad secret key ${JSON.stringify(key)}: use <realm>/<name>`);
  return { realm: m[1], name: m[2] };
}

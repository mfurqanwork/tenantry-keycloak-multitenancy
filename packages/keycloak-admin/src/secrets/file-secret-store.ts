import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSecretKey, type SecretStore } from './secret-store.js';

// Local development: one JSON file per realm in a git-ignored folder, written atomically and readable by
// the owner only where the platform supports it. A cloud secrets manager replaces this in production.
export function createFileSecretStore(dir: string): SecretStore {
  const fileOf = (realm: string) => join(dir, `${realm}.json`);
  const read = async (realm: string): Promise<Record<string, string>> => {
    try {
      return JSON.parse(await readFile(fileOf(realm), 'utf8')) as Record<string, string>;
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return {};
      throw err;
    }
  };
  return {
    async get(key) {
      const { realm, name } = parseSecretKey(key);
      return (await read(realm))[name] ?? null;
    },
    async put(key, value) {
      const { realm, name } = parseSecretKey(key);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const next = { ...(await read(realm)), [name]: value };
      const temp = `${fileOf(realm)}.${String(process.pid)}.tmp`;
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temp, fileOf(realm));
    },
  };
}

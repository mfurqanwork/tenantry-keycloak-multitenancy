import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileSecretStore } from './file-secret-store.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tenantry-secrets-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('file secret store', () => {
  it('keeps a secret and gives it back', async () => {
    const store = createFileSecretStore(dir);
    await store.put('ent-initech/tenantry-backend', 's3cret');
    expect(await store.get('ent-initech/tenantry-backend')).toBe('s3cret');
    // A second store over the same folder (another API process) reads the same value.
    expect(await createFileSecretStore(dir).get('ent-initech/tenantry-backend')).toBe('s3cret');
  });

  it('answers null for a secret it does not have', async () => {
    expect(await createFileSecretStore(dir).get('ent-nobody/tenantry-backend')).toBeNull();
  });

  it('replaces a secret', async () => {
    const store = createFileSecretStore(dir);
    await store.put('ent-a/tenantry-backend', 'one');
    await store.put('ent-a/tenantry-backend', 'two');
    expect(await store.get('ent-a/tenantry-backend')).toBe('two');
  });

  it('keeps each realm in its own file inside the folder', async () => {
    const store = createFileSecretStore(dir);
    await store.put('ent-a/tenantry-backend', 'one');
    await store.put('ent-b/tenantry-backend', 'two');
    expect(readdirSync(dir).sort()).toEqual(['ent-a.json', 'ent-b.json']);
  });

  it('refuses keys that could reach outside the folder', async () => {
    const store = createFileSecretStore(dir);
    for (const key of ['../x/y', 'ent-a/../../z', 'ENT/A', 'a', '/abs/key', 'ent-a/b/c']) {
      await expect(store.put(key, 'v')).rejects.toThrow(/key/);
    }
  });
});

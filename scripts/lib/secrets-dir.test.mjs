import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSecretsDir } from './secrets-dir.mjs';

// Docker creates a missing bind-mount folder as root, and `pnpm ops idp link` on the host then cannot
// write the company login's secret there (Phase 5b CI). The folder is made first, by the host user.
test('makes the secrets folder before Docker can', () => {
  const root = mkdtempSync(join(tmpdir(), 'tenantry-secrets-'));
  try {
    const dir = join(root, '.secrets');
    prepareSecretsDir(dir, { getuid: null, getgid: null });
    assert.ok(statSync(dir).isDirectory());
    prepareSecretsDir(dir, { getuid: null, getgid: null });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('on Linux and macOS the API container writes the secrets as the host user', () => {
  const root = mkdtempSync(join(tmpdir(), 'tenantry-secrets-'));
  try {
    const env = prepareSecretsDir(join(root, '.secrets'), { getuid: () => 1001, getgid: () => 127 });
    assert.deepEqual(env, { TENANTRY_UID: '1001', TENANTRY_GID: '127' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('on Windows nothing changes the container user', () => {
  const root = mkdtempSync(join(tmpdir(), 'tenantry-secrets-'));
  try {
    assert.deepEqual(prepareSecretsDir(join(root, '.secrets'), { getuid: null, getgid: null }), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

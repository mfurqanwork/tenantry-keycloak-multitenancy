import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { ROOT } from './env.mjs';

const eslint = new ESLint({ cwd: new URL('.', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

// Lints a throwaway file at a real path, so the per-area rules apply as they would to real code.
async function importErrors(path, source) {
  const file = new URL(path, ROOT);
  writeFileSync(file, `${source}\nexport {};\n`);
  try {
    const [result] = await eslint.lintFiles([file.pathname.replace(/^\/([A-Za-z]:)/, '$1')]);
    return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
  } finally {
    rmSync(file);
  }
}

test('only @tenantry/oidc-client imports oidc-client-ts', async () => {
  const errors = await importErrors(
    'apps/web/src/lint-probe.ts',
    "import { UserManager } from 'oidc-client-ts';\nvoid UserManager;",
  );
  assert.equal(errors.length, 1, 'web may not import oidc-client-ts');
});

test('features do not build the Keycloak HTTP client; the infrastructure module does', async () => {
  const source =
    "import { createHttpIdentityDirectory } from '@tenantry/keycloak-admin';\nvoid createHttpIdentityDirectory;";
  assert.equal((await importErrors('apps/api/src/modules/members/lint-probe.ts', source)).length, 1);
  assert.equal((await importErrors('apps/api/src/infrastructure/lint-probe.ts', source)).length, 0);
});

test('a module reaches another module only through its service or module', async () => {
  const internals =
    "import { MembersController } from '../members/members.controller.js';\nvoid MembersController;";
  assert.equal((await importErrors('apps/api/src/modules/audit/lint-probe.ts', internals)).length, 1);
  const service = "import { AuditService } from '../audit/audit.service.js';\nvoid AuditService;";
  assert.equal((await importErrors('apps/api/src/modules/projects/lint-probe.ts', service)).length, 0);
});

test('only packages/db imports pg', async () => {
  assert.equal(
    (await importErrors('apps/api/src/lint-probe.ts', "import pg from 'pg';\nvoid pg;")).length,
    1,
  );
});

test('app code never imports the test-only helpers; tests and test-utils do', async () => {
  const source = "import { fakeApi } from '@tenantry/app-kit/testing';\nvoid fakeApi;";
  const testingErrors = async (path) => {
    const file = new URL(path, ROOT);
    writeFileSync(file, `${source}\nexport {};\n`);
    try {
      const [result] = await eslint.lintFiles([file.pathname.replace(/^\/([A-Za-z]:)/, '$1')]);
      return result.messages.filter((m) => m.ruleId === '@typescript-eslint/no-restricted-imports');
    } finally {
      rmSync(file);
    }
  };
  assert.equal((await testingErrors('apps/portal/src/lint-probe.ts')).length, 1);
  assert.equal((await testingErrors('apps/web/src/lint-probe.tsx')).length, 1);
  assert.equal((await testingErrors('apps/portal/src/lint-probe.test.ts')).length, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAll } from './smoke-live.mjs';

const quiet = { attempts: 3, waitMs: 0, log: () => undefined };

test('counts checks that never pass', async () => {
  const failed = await checkAll(
    [
      ['ok', async () => true],
      ['bad', async () => 'nope'],
      [
        'throws',
        async () => {
          throw new Error('down');
        },
      ],
    ],
    quiet,
  );
  assert.equal(failed, 2);
});

test('retries a check until it passes', async () => {
  let calls = 0;
  const failed = await checkAll([['later', async () => ++calls === 3 || 'not yet']], quiet);
  assert.equal(failed, 0);
  assert.equal(calls, 3);
});

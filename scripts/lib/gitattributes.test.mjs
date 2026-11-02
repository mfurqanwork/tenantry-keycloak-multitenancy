import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Containers misread CRLF config files, so a Windows clone must keep LF.
test('.gitattributes forces LF line endings', () => {
  const attrs = readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8');
  assert.match(attrs, /^\* text=auto eol=lf$/m);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { isPortFree } from './port.mjs';

test('isPortFree reports a port held by another server as busy, then free once released', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  const { port } = server.address();
  assert.equal(await isPortFree(port), false);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await isPortFree(port), true);
});

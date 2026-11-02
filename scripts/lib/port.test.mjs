import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { busyPorts, isPortFree } from './port.mjs';

test('isPortFree reports a port held by another server as busy, then free once released', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  const { port } = server.address();
  assert.equal(await isPortFree(port), false);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await isPortFree(port), true);
});

test('isPortFree only calls a port busy when something else holds it', async () => {
  const failingWith = (code) => () => {
    const server = new net.Server();
    server.listen = () => {
      queueMicrotask(() => server.emit('error', Object.assign(new Error(code), { code })));
      return server;
    };
    return server;
  };
  assert.equal(await isPortFree(80, failingWith('EADDRINUSE')), false);
  // Linux refuses unprivileged binds below 1024, yet Docker can still publish them.
  assert.equal(await isPortFree(80, failingWith('EACCES')), true);
});

test('busyPorts lists each busy port with the variable that sets it', async () => {
  const free = new Set([8080]);
  const result = await busyPorts({ TENANTRY_HTTP_PORT: 8080, TENANTRY_PG_PORT: 5432 }, async (port) =>
    free.has(port),
  );
  assert.deepEqual(result, [{ name: 'TENANTRY_PG_PORT', port: 5432 }]);
});

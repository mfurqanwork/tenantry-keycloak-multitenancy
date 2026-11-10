import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from './http.js';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

function listen(): Promise<{ port: number; seen: { host?: string | undefined }[] }> {
  const seen: { host?: string | undefined }[] = [];
  const server = createServer((req, res) => {
    seen.push({ host: req.headers.host });
    res.end('{}');
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: (server.address() as AddressInfo).port, seen });
    });
  });
}

describe('apiClient', () => {
  it('adds the published port to the workspace host, as a browser does', async () => {
    const { port, seen } = await listen();
    await apiClient(port)('acme.tenantry.localhost', 'GET', '/');
    expect(seen[0]?.host).toBe(`acme.tenantry.localhost:${String(port)}`);
  });

  it('reaches an internal upstream with the plain workspace host', async () => {
    const { port, seen } = await listen();
    await apiClient(80, `127.0.0.1:${String(port)}`)('acme.tenantry.example', 'GET', '/');
    expect(seen[0]?.host).toBe('acme.tenantry.example');
  });
});

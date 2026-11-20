import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { ingestRelay } from './ingest-relay.js';

const KEY = 'phc_test123';
const HOST = 'https://eu.i.posthog.com';
const servers: { close: () => void }[] = [];

async function relay(key: string | null) {
  const sent: string[] = [];
  const fakeFetch = ((url: string) => {
    sent.push(url);
    return Promise.resolve(new Response('{}'));
  }) as unknown as typeof fetch;
  const app = express();
  app.use('/api/ingest', ingestRelay(key, HOST, fakeFetch));
  const server = app.listen(0);
  servers.push(server);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ingest`;
  const post = (path: string, body: string | Uint8Array<ArrayBuffer>, method = 'POST') =>
    fetch(`${base}${path}`, { method, ...(method === 'GET' ? {} : { body }) }).then((r) => r.status);
  return { post, sent };
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe('the PostHog relay', () => {
  it("passes this project's events to PostHog EU, and refuses everything else", async () => {
    const { post, sent } = await relay(KEY);
    const event = JSON.stringify({ api_key: KEY, event: '$pageview' });
    expect(await post('/e/?ver=1', event)).toBe(200);
    expect(await post('/i/v0/e/', new Uint8Array(gzipSync(event)))).toBe(200);

    expect(await post('/e/', JSON.stringify({ api_key: 'phc_other' }))).toBe(403);
    expect(await post('/flags/?v=2', event)).toBe(404);
    expect(await post('/static/array.js', '', 'GET')).toBe(404);
    expect(await post('/e/', 'x'.repeat(1024 * 1024 + 10))).toBe(413);
    expect(sent).toEqual([`${HOST}/e/?ver=1`, `${HOST}/i/v0/e/`]);
  });

  it('is not there without a key', async () => {
    const { post, sent } = await relay(null);
    expect(await post('/e/', JSON.stringify({ api_key: KEY }))).toBe(404);
    expect(sent).toEqual([]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';

const file = new URL('../../../.env', import.meta.url);
const port = Number(
  process.env['TENANTRY_HTTP_PORT'] ??
    (existsSync(file)
      ? /^TENANTRY_HTTP_PORT=(.*)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim()
      : undefined) ??
    '80',
);

// Mailpit through Caddy, as the browser reaches it.
export function mailsTo(address: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request(
      {
        host: '127.0.0.1',
        port,
        path: `/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        headers: { host: `mail.tenantry.localhost:${String(port)}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (c: Buffer) => (raw += c.toString()));
        res.on('end', () => {
          resolve((JSON.parse(raw) as { messages_count: number }).messages_count);
        });
      },
    )
      .on('error', reject)
      .end();
  });
}

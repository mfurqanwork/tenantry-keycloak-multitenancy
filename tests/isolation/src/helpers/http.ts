import { request } from 'node:http';
import { BASE_DOMAIN, HTTP_PORT } from './env.js';

export interface Reply<T = unknown> {
  status: number;
  body: T;
}

export const apexHost = BASE_DOMAIN;
export const tenantHost = (slug: string) => `${slug}.${BASE_DOMAIN}`;

// Through Caddy, exactly as a browser would arrive: 127.0.0.1 with the tenant's Host header.
export function api<T = unknown>(
  host: string,
  method: string,
  path: string,
  o: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Reply<T>> {
  const payload = o.body === undefined ? undefined : JSON.stringify(o.body);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: HTTP_PORT,
        method,
        path,
        headers: {
          host: HTTP_PORT === 80 ? host : `${host}:${String(HTTP_PORT)}`,
          ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...o.headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          raw += chunk;
        });
        res.on('end', () => {
          let body: unknown = raw;
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            // Not JSON; keep the text.
          }
          resolve({ status: res.statusCode ?? 0, body: body as T });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

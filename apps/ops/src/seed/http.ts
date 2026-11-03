import { request } from 'node:http';

export interface Reply<T = unknown> {
  status: number;
  body: T;
}

// The API through Caddy, as a browser reaches it: 127.0.0.1 with the workspace's Host header (Node
// cannot resolve *.localhost names on every platform).
export function apiClient(port: number) {
  return function call<T = unknown>(
    host: string,
    method: string,
    path: string,
    o: { token?: string; body?: unknown; raw?: Buffer; headers?: Record<string, string> } = {},
  ): Promise<Reply<T>> {
    const payload = o.raw ?? (o.body === undefined ? undefined : Buffer.from(JSON.stringify(o.body)));
    return new Promise((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          method,
          path,
          headers: {
            host: port === 80 ? host : `${host}:${String(port)}`,
            ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
            ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...o.headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let body: unknown = text;
            try {
              body = text ? JSON.parse(text) : undefined;
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
  };
}

export type ApiCall = ReturnType<typeof apiClient>;

import { gunzipSync } from 'node:zlib';
import { raw, type NextFunction, type Request, type Response } from 'express';

// The only PostHog endpoints the browser library posts events to. Flags, recordings and scripts stay off.
const ALLOWED = new Set(['/e/', '/e', '/i/v0/e/', '/i/v0/e', '/batch/', '/batch']);
const MAX_BODY = 1024 * 1024;
const body = raw({ type: () => true, limit: MAX_BODY });

// First-party relay for posthog-js at /api/ingest on every app host, so the CSP stays connect-src
// 'self' and no third-party host sees the visitor. Not an open proxy: POST only, a fixed upstream,
// a short list of paths, a size limit, and the body must carry this installation's project key
// (gzip bodies are unpacked to check). No key: 404.
export function ingestRelay(key: string | null, host: string, fetchFn: typeof fetch = fetch) {
  return (req: Request, res: Response, _next: NextFunction): void => {
    if (!key || req.method !== 'POST' || !ALLOWED.has(req.path)) {
      res.status(404).end();
      return;
    }
    body(req, res, (err?: unknown) => {
      if (err) {
        res.status((err as { status?: number }).status === 413 ? 413 : 400).end();
        return;
      }
      void forward(req, res, key, host, fetchFn);
    });
  };
}

async function forward(req: Request, res: Response, key: string, host: string, fetchFn: typeof fetch) {
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!carriesKey(bytes, key)) {
    res.status(403).end();
    return;
  }
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  const forwardedFor = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
  try {
    const upstream = await fetchFn(`${host}${req.path}${query}`, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] ?? 'text/plain',
        ...(forwardedFor ? { 'x-forwarded-for': String(forwardedFor) } : {}),
      },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(10_000),
    });
    res.status(upstream.ok ? 200 : upstream.status).json({ status: upstream.ok ? 1 : 0 });
  } catch {
    res.status(502).end();
  }
}

// Reads the body the way PostHog does: gzip (spotted by its magic bytes) or plain JSON.
function carriesKey(bytes: Buffer, key: string): boolean {
  try {
    const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    const text = gzip ? gunzipSync(bytes, { maxOutputLength: 8 * MAX_BODY }).toString('utf8') : bytes.toString('utf8');
    return text.includes(key);
  } catch {
    return false;
  }
}

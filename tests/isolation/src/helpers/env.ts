import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../../../../.env', import.meta.url);
const fromFile: Record<string, string> = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && m[2] !== undefined) fromFile[m[1]] = m[2];
  }
}

// The stack's own .env; real environment variables win (CI).
export function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fromFile[key] ?? fallback;
  if (value === undefined) throw new Error(`${key} is not set: copy .env.example to .env`);
  return value;
}

export const HTTP_PORT = Number(env('TENANTRY_HTTP_PORT', '80'));
export const BASE_DOMAIN = env('TENANTRY_BASE_DOMAIN', 'tenantry.localhost');
// Keycloak's loopback port: Node cannot resolve *.localhost names on every platform.
export const KEYCLOAK_URL = env('TENANTRY_AUTH_INTERNAL_URL', 'http://127.0.0.1:8180');

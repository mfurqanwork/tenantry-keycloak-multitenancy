import { existsSync, readFileSync } from 'node:fs';

// The stack's .env at the repository root; real environment variables win (CI, production shells).
export function stackEnv(key: string, fallback?: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  const file = new URL('../../../.env', import.meta.url);
  const value = existsSync(file)
    ? new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'))?.[1]?.trim()
    : undefined;
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${key} is not set: copy .env.example to .env`);
}

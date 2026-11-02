import { existsSync, readFileSync } from 'node:fs';

// Integration tests use the same .env as the stack; real environment variables win (CI).
export function stackEnv(key: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  const file = new URL('../../../../.env', import.meta.url);
  const value = existsSync(file)
    ? new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(file, 'utf8'))?.[1]
    : undefined;
  if (!value) throw new Error(`${key} is not set: copy .env.example to .env`);
  return value.trim();
}

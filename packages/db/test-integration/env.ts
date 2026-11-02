import { existsSync, readFileSync } from 'node:fs';

// The tests read the same .env as the stack; real environment variables win (CI).
export function integrationEnv(): { appUrl: string; ownerUrl: string } {
  const file = new URL('../../../.env', import.meta.url);
  const fromFile: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m?.[1] && m[2] !== undefined) fromFile[m[1]] = m[2];
    }
  }
  const get = (key: string) => {
    const value = process.env[key] ?? fromFile[key];
    if (!value) throw new Error(`${key} is not set: copy .env.example to .env`);
    return value;
  };
  return { appUrl: get('DATABASE_URL'), ownerUrl: get('DATABASE_OWNER_URL') };
}

import { copyFileSync, existsSync, readFileSync } from 'node:fs';

export const ROOT = new URL('../../', import.meta.url);

// First run: start from the committed example so one command is enough.
export function ensureEnv() {
  const env = new URL('.env', ROOT);
  if (!existsSync(env)) {
    copyFileSync(new URL('.env.example', ROOT), env);
    console.log('Created .env from .env.example');
  }
  return parseEnv(readFileSync(env, 'utf8'));
}

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

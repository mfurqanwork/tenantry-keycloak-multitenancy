import { z } from 'zod';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  authUrl: string;
  platformRealm: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TENANTRY_AUTH_URL: z.url(),
  TENANTRY_PLATFORM_REALM: z.string().min(1).default('platform'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Fails fast at startup, naming every bad variable at once.
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new ConfigError(`Invalid environment: ${problems.join('; ')}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    authUrl: e.TENANTRY_AUTH_URL.replace(/\/$/, ''),
    platformRealm: e.TENANTRY_PLATFORM_REALM,
    logLevel: e.LOG_LEVEL,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

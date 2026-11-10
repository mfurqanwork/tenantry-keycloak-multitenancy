import { z } from 'zod';

export interface AppConfig {
  // The release this image was built from (ADR-0030); 'dev' otherwise.
  version: string;
  port: number;
  databaseUrl: string;
  authUrl: string;
  authInternalUrl: string;
  platformRealm: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  baseDomain: string;
  // The port browsers use, read from the public auth URL; null when it is the default 80.
  publicPort: number | null;
  backendClientId: string;
  backendClientSecret: string;
  // Enterprise realms (ADR-0010, ADR-0023).
  provisionerClientId: string;
  provisionerClientSecret: string;
  secretsDir: string;
  smtp: { host: string; port: string; from: string };
  // Customer apps per enterprise workspace (ADR-0011).
  maxAppsPerTenant: number;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TENANTRY_AUTH_URL: z.url(),
  // Where this process reaches Keycloak, when that differs from the public URL (host-mode `pnpm dev`).
  TENANTRY_AUTH_INTERNAL_URL: z.url().optional(),
  TENANTRY_PLATFORM_REALM: z.string().min(1).default('platform'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  TENANTRY_VERSION: z.string().min(1).default('dev'),
  TENANTRY_BASE_DOMAIN: z.string().min(1).default('tenantry.localhost'),
  KEYCLOAK_BACKEND_CLIENT_ID: z.string().min(1),
  KEYCLOAK_BACKEND_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_PROVISIONER_CLIENT_ID: z.string().min(1).default('tenantry-provisioner'),
  KEYCLOAK_PROVISIONER_CLIENT_SECRET: z.string().min(1).default('unset'),
  TENANTRY_SECRETS_DIR: z.string().min(1).default('.secrets'),
  TENANTRY_SMTP_HOST: z.string().min(1).default('mailpit'),
  TENANTRY_SMTP_PORT: z.string().min(1).default('1025'),
  TENANTRY_SMTP_FROM: z.string().min(1).default('no-reply@tenantry.localhost'),
  TENANTRY_MAX_APPS_PER_TENANT: z.coerce.number().int().positive().default(20),
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
    version: e.TENANTRY_VERSION,
    authInternalUrl: (e.TENANTRY_AUTH_INTERNAL_URL ?? e.TENANTRY_AUTH_URL).replace(/\/$/, ''),
    platformRealm: e.TENANTRY_PLATFORM_REALM,
    logLevel: e.LOG_LEVEL,
    baseDomain: e.TENANTRY_BASE_DOMAIN,
    publicPort: new URL(e.TENANTRY_AUTH_URL).port ? Number(new URL(e.TENANTRY_AUTH_URL).port) : null,
    backendClientId: e.KEYCLOAK_BACKEND_CLIENT_ID,
    backendClientSecret: e.KEYCLOAK_BACKEND_CLIENT_SECRET,
    provisionerClientId: e.KEYCLOAK_PROVISIONER_CLIENT_ID,
    provisionerClientSecret: e.KEYCLOAK_PROVISIONER_CLIENT_SECRET,
    secretsDir: e.TENANTRY_SECRETS_DIR,
    smtp: { host: e.TENANTRY_SMTP_HOST, port: e.TENANTRY_SMTP_PORT, from: e.TENANTRY_SMTP_FROM },
    maxAppsPerTenant: e.TENANTRY_MAX_APPS_PER_TENANT,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

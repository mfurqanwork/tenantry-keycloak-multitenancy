import { readFileSync } from 'node:fs';

// The realm template version this code ships and provisions (ADR-0010). Upgrades move realms to it.
export const TEMPLATE_VERSION = 1;

export interface TemplateVars {
  displayName: string;
  webOrigin: string;
  portalOrigin: string;
  smtp: { host: string; port: string; from: string };
  // Local development serves http; anywhere else redirect URIs must be https.
  allowHttpRedirects: boolean;
}

export interface RealmTemplate {
  version: number;
  // Realm settings, applied with PUT /admin/realms/<realm>.
  realm: Record<string, unknown>;
  clientProfiles: { profiles: Record<string, unknown>[] };
  clientPolicies: { policies: Record<string, unknown>[] };
}

export interface ClientTemplate {
  representation: Record<string, unknown>;
  // Client roles to define on this client (tenantry-api's owner, admin, member).
  roles: string[];
  // realm-management roles for this client's service account (tenantry-backend).
  serviceAccountRoles: string[];
}

const PRODUCT_CLIENTS = ['tenantry-api', 'tenantry-web', 'tenantry-portal', 'tenantry-backend'] as const;
const file = (path: string) => readFileSync(new URL(`../../templates/${path}`, import.meta.url), 'utf8');

// Placeholders are ${NAME}. A quoted placeholder whose value is a boolean becomes a JSON boolean; any
// other value is inserted as JSON string content.
function fill(text: string, values: Record<string, string | boolean>): unknown {
  const filled = text
    .replace(/"\$\{([A-Z_]+)\}"/g, (whole, name: string) =>
      typeof values[name] === 'boolean' ? String(values[name]) : whole,
    )
    .replace(/\$\{([A-Z_]+)\}/g, (_whole, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`template placeholder ${name} has no value`);
      return JSON.stringify(String(value)).slice(1, -1);
    });
  return JSON.parse(filled);
}

const placeholders = (v: TemplateVars): Record<string, string | boolean> => ({
  DISPLAY_NAME: v.displayName,
  WEB_ORIGIN: v.webOrigin,
  PORTAL_ORIGIN: v.portalOrigin,
  SMTP_HOST: v.smtp.host,
  SMTP_PORT: v.smtp.port,
  SMTP_FROM: v.smtp.from,
  ALLOW_HTTP_REDIRECTS: v.allowHttpRedirects,
});

export function loadRealmTemplate(version: number, vars: TemplateVars): RealmTemplate {
  if (version !== TEMPLATE_VERSION)
    throw new Error(`No enterprise realm template version ${String(version)}`);
  const t = fill(file(`enterprise-realm.v${String(version)}.json`), placeholders(vars)) as {
    templateVersion: number;
    realm: Record<string, unknown>;
    clientProfiles: RealmTemplate['clientProfiles'];
    clientPolicies: RealmTemplate['clientPolicies'];
  };
  return {
    version: t.templateVersion,
    realm: { ...t.realm, displayName: vars.displayName },
    clientProfiles: t.clientProfiles,
    clientPolicies: t.clientPolicies,
  };
}

export function loadProductClients(vars: TemplateVars): ClientTemplate[] {
  return PRODUCT_CLIENTS.map((name) => {
    const {
      roles = [],
      serviceAccountRealmManagementRoles = [],
      ...representation
    } = fill(file(`product-clients/${name}.json`), placeholders(vars)) as Record<string, unknown> & {
      roles?: { name: string }[];
      serviceAccountRealmManagementRoles?: string[];
    };
    return {
      representation,
      roles: roles.map((r) => r.name),
      serviceAccountRoles: serviceAccountRealmManagementRoles,
    };
  });
}

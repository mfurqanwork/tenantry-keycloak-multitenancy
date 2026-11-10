// The production realms, generated from the dev ones so there is one source (ADR-0029). Keycloak fills the
// ${NAME} placeholders from its environment when it imports them.
export function productionRealms({ platform, corp, baseDomain }) {
  const prod = structuredClone(platform);
  const company = structuredClone(corp);
  const find = (realm, id) => {
    const found = realm.clients.find((c) => c.clientId === id);
    if (!found) throw new Error(`client ${id} is missing`);
    return found;
  };

  prod.smtpServer.from = `no-reply@${baseDomain}`;
  find(prod, 'tenantry-web').redirectUris = [`https://${baseDomain}/*`];
  find(prod, 'tenantry-backend').secret = '${KEYCLOAK_BACKEND_CLIENT_SECRET}';
  find(prod, 'tenantry-ops').secret = '${KEYCLOAK_OPS_CLIENT_SECRET}';
  // Off at rest; the seed turns it on for its own run (scripts/prod-seed.mjs).
  const seedClient = find(prod, 'tenantry-isolation-tests');
  seedClient.secret = '${TENANTRY_ISOLATION_CLIENT_SECRET}';
  seedClient.enabled = false;

  const broker = find(company, 'tenantry-platform');
  broker.secret = '${CORP_DEMO_CLIENT_SECRET}';
  broker.redirectUris = [`https://auth.${baseDomain}/realms/platform/broker/*`];

  return { platform: prod, corp: company };
}

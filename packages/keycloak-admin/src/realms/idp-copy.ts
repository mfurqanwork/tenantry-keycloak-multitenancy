import type { IdentityProviderSettings } from '../identity-directory.js';
import { provisionerCalls, type ProvisionerAccess } from './realm-admin-call.js';

// A workspace's company logins, copied into its own realm on a move to Enterprise (ADR-0025), and the
// links that let each person keep signing in through them.
export interface RealmIdps {
  // Enabled with the kept secret, disabled without one (Keycloak never returns a provider's secret).
  copy(provider: IdentityProviderSettings, secret: string | null): Promise<{ enabled: boolean }>;
  setSecret(alias: string, secret: string): Promise<void>;
  // The person's account at that provider, linked to their account in this realm.
  link(kcUserId: string, alias: string, remote: { userId: string; userName: string }): Promise<void>;
}

export const idpSecretKey = (alias: string) => `platform/idp-${alias}`;

export function createRealmIdps(o: ProvisionerAccess): RealmIdps {
  const { call, json } = provisionerCalls(o);
  const instance = (alias: string) => `/identity-provider/instances/${encodeURIComponent(alias)}`;

  return {
    async copy(provider, secret) {
      const enabled = secret !== null;
      const representation = {
        alias: provider.alias,
        providerId: 'oidc',
        enabled,
        trustEmail: true,
        config: { ...provider.config, clientSecret: secret ?? '' },
      };
      const existing = await call('copyIdp', 'GET', instance(provider.alias), undefined, [404]);
      if (existing.status === 404) {
        await call('copyIdp', 'POST', '/identity-provider/instances', representation);
      } else {
        const current = await json<{ enabled: boolean; config: Record<string, string> }>(existing);
        // A rerun keeps a secret set since by idp-secret, and does not turn the provider off again.
        if (secret !== null || !current.enabled) {
          await call('copyIdp', 'PUT', instance(provider.alias), {
            ...current,
            ...representation,
            ...(secret === null
              ? { config: { ...provider.config, clientSecret: current.config['clientSecret'] ?? '' } }
              : {}),
          });
        }
      }
      const mappers = await json<{ name: string }[]>(
        await call('copyIdp', 'GET', `${instance(provider.alias)}/mappers`),
      );
      for (const m of provider.mappers) {
        if (mappers.some((x) => x.name === m.name)) continue;
        await call('copyIdp', 'POST', `${instance(provider.alias)}/mappers`, {
          ...m,
          identityProviderAlias: provider.alias,
        });
      }
      const after = await json<{ enabled: boolean }>(await call('copyIdp', 'GET', instance(provider.alias)));
      return { enabled: after.enabled };
    },

    async setSecret(alias, secret) {
      const current = await json<{ config: Record<string, string> }>(
        await call('setIdpSecret', 'GET', instance(alias)),
      );
      await call('setIdpSecret', 'PUT', instance(alias), {
        ...current,
        enabled: true,
        config: { ...current.config, clientSecret: secret },
      });
    },

    async link(kcUserId, alias, remote) {
      await call(
        'linkIdentity',
        'POST',
        `/users/${encodeURIComponent(kcUserId)}/federated-identity/${encodeURIComponent(alias)}`,
        { identityProvider: alias, userId: remote.userId, userName: remote.userName },
        [409],
      );
    },
  };
}

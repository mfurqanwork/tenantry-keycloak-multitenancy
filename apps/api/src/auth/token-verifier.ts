import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { UnauthorizedProblem } from '../common/http-errors.js';

export type TokenVerifier = (token: string) => Promise<JWTPayload>;

// Issuer and audience are checked here (guard steps 3–5). The key set is cached and refetched
// when a token names an unknown key id, so a Keycloak key rotation needs no restart. The cooldown
// (default 30 s since the last fetch) stops a flood of made-up key ids from hammering Keycloak.
export function createTokenVerifier(o: {
  jwksUrl: URL;
  issuer: string;
  audience: string;
  cooldownMs?: number;
}): TokenVerifier {
  const keys = createRemoteJWKSet(o.jwksUrl, { cooldownDuration: o.cooldownMs ?? 30_000 });
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer: o.issuer, audience: o.audience });
      return payload;
    } catch {
      throw new UnauthorizedProblem('The access token is missing, expired or not for this workspace.');
    }
  };
}

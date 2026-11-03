import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type JWTPayload } from 'jose';

export interface TestIssuer {
  // Base URL standing in for Keycloak: use it as both authUrl and authInternalUrl.
  baseUrl: string;
  issuer: string;
  jwksUrl: string;
  sign(claims: JWTPayload): Promise<string>;
  rotate(): Promise<void>;
  close(): Promise<void>;
}

// A local stand-in for Keycloak: serves one key set for every realm and signs tokens with it. Tokens
// carry the platform issuer unless a test sets another realm's `iss`.
export async function makeTestIssuer(realm = 'platform'): Promise<TestIssuer> {
  let key = await newKey();
  const server: Server = createServer((req, res) => {
    if (/^\/realms\/[^/]+\/protocol\/openid-connect\/certs$/.test(req.url ?? '')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [key.publicJwk] }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const issuer = `${baseUrl}/realms/${realm}`;

  return {
    baseUrl,
    issuer,
    jwksUrl: `${issuer}/protocol/openid-connect/certs`,
    sign: (claims) =>
      new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: key.kid })
        .setIssuer(claims.iss ?? issuer)
        .setIssuedAt()
        .setExpirationTime(claims.exp ?? '5m')
        .sign(key.privateKey),
    rotate: async () => {
      key = await newKey();
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

async function newKey(): Promise<{ kid: string; privateKey: CryptoKey; publicJwk: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const kid = crypto.randomUUID();
  return { kid, privateKey, publicJwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } };
}

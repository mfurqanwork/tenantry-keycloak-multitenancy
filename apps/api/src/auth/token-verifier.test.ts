import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnauthorizedProblem } from '../common/http-errors.js';
import { makeTestIssuer, type TestIssuer } from '../testing/tokens.js';
import { createTokenVerifier } from './token-verifier.js';

let issuer: TestIssuer;
let verify: (token: string) => Promise<unknown>;

beforeAll(async () => {
  issuer = await makeTestIssuer();
  verify = createTokenVerifier({
    jwksUrl: new URL(issuer.jwksUrl),
    issuer: issuer.issuer,
    audience: 'tenantry-api',
    cooldownMs: 0,
  });
});
afterAll(() => issuer.close());

describe('createTokenVerifier', () => {
  it('accepts a valid token', async () => {
    const token = await issuer.sign({ sub: 'u1', aud: 'tenantry-api' });
    await expect(verify(token)).resolves.toMatchObject({ sub: 'u1' });
  });

  it('rejects a token from another issuer', async () => {
    const token = await issuer.sign({ sub: 'u1', aud: 'tenantry-api', iss: 'http://other/realms/platform' });
    await expect(verify(token)).rejects.toBeInstanceOf(UnauthorizedProblem);
  });

  it('rejects a token for another audience', async () => {
    const token = await issuer.sign({ sub: 'u1', aud: 'account' });
    await expect(verify(token)).rejects.toBeInstanceOf(UnauthorizedProblem);
  });

  it('rejects an expired token', async () => {
    const token = await issuer.sign({
      sub: 'u1',
      aud: 'tenantry-api',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await expect(verify(token)).rejects.toBeInstanceOf(UnauthorizedProblem);
  });

  it('rejects garbage', async () => {
    await expect(verify('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedProblem);
  });

  it('follows a key rotation', async () => {
    await verify(await issuer.sign({ sub: 'u1', aud: 'tenantry-api' }));
    await issuer.rotate();
    const token = await issuer.sign({ sub: 'u2', aud: 'tenantry-api' });
    await expect(verify(token)).resolves.toMatchObject({ sub: 'u2' });
  });
});

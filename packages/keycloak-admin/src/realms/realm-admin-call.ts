import { createAdminTokenSource } from '../admin-token.js';
import { DirectoryError } from '../errors.js';

export interface ProvisionerAccess {
  baseUrl: string;
  realm: string;
  provisionerClientId: string;
  provisionerClientSecret: string;
  fetch?: typeof fetch;
}

// Admin calls into one realm as the create-realm provisioner (ADR-0010), which administers the realms it
// made. Shared by the realm pieces a move to Enterprise uses.
export function provisionerCalls(o: ProvisionerAccess) {
  const doFetch = o.fetch ?? fetch;
  const token = createAdminTokenSource({
    baseUrl: o.baseUrl,
    realm: 'master',
    clientId: o.provisionerClientId,
    clientSecret: o.provisionerClientSecret,
    fetch: doFetch,
  });
  const admin = `${o.baseUrl}/admin/realms/${encodeURIComponent(o.realm)}`;
  async function call(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
    accept: number[] = [],
  ) {
    const res = await doFetch(`${admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await token()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!res.ok && !accept.includes(res.status)) {
      throw new DirectoryError(operation, res.status, await res.text().catch(() => ''));
    }
    return res;
  }
  const json = async <T>(res: Response) => (await res.json()) as T;
  return { call, json };
}

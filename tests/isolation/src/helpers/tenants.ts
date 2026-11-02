import { randomUUID } from 'node:crypto';
import { api, apexHost } from './http.js';
import { createUser, tokenFor, type TestUser } from './keycloak.js';

export interface TestTenant {
  slug: string;
  owner: TestUser;
  ownerToken: string;
}

// Unique per run, so the suite can run against a stack that already has data.
export const newSlug = (label: string) => `iso${label}${randomUUID().slice(0, 6)}`;

// A real signup through the API, as the web app does it.
export async function signupTenant(label: string): Promise<TestTenant> {
  const slug = newSlug(label);
  const owner = await createUser(`${label}-owner`);
  const res = await api(apexHost, 'POST', '/api/signup', {
    token: await tokenFor(owner),
    body: { name: `Isolation ${label}`, slug },
  });
  if (res.status !== 201)
    throw new Error(`signup ${slug}: ${String(res.status)} ${JSON.stringify(res.body)}`);
  return { slug, owner, ownerToken: await tokenFor(owner, slug) };
}

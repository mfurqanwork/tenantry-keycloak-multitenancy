import { describe, expect, it, vi } from 'vitest';
import {
  migrateEnterprise,
  provisionEnterprise,
  setIdpSecretCommand,
  upgradeEnterprise,
  type EnterpriseDeps,
} from './enterprise.js';

function deps(reply: { status: number; body: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const api = vi.fn().mockResolvedValue(reply);
  const d: EnterpriseDeps = {
    api,
    operatorToken: () => Promise.resolve('op-token'),
    baseDomain: 'tenantry.localhost',
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  };
  return { d, out, err, api };
}

describe('ops enterprise provision', () => {
  it('calls the API on the base domain with the operator token and says where the tenant is', async () => {
    const { d, out, api } = deps({
      status: 201,
      body: {
        slug: 'initech',
        status: 'active',
        realm: 'ent-initech',
        webUrl: 'http://initech.tenantry.localhost/',
      },
    });
    expect(
      await provisionEnterprise(d, { slug: 'initech', name: 'Initech', adminEmail: 'owner@initech.test' }),
    ).toBe(0);
    expect(api).toHaveBeenCalledWith('tenantry.localhost', 'POST', '/api/platform/enterprise-tenants', {
      token: 'op-token',
      body: { slug: 'initech', name: 'Initech', adminEmail: 'owner@initech.test' },
    });
    expect(out.join('\n')).toMatch(
      /initech is ready at http:\/\/initech\.tenantry\.localhost\/ \(realm ent-initech\)/,
    );
    expect(out.join('\n')).toMatch(/owner@initech\.test/);
  });

  it("exits 1 with the API's detail on a refusal", async () => {
    const { d, err } = deps({ status: 409, body: { detail: 'A Standard workspace has that address.' } });
    expect(await provisionEnterprise(d, { slug: 'acme', name: 'Acme', adminEmail: 'a@b.test' })).toBe(1);
    expect(err).toEqual(['A Standard workspace has that address.']);
  });
});

describe('ops enterprise upgrade', () => {
  it('reports a realm it could not read and exits 1, after printing the others', async () => {
    const { d, out, err } = deps({
      status: 200,
      body: [
        {
          slug: 'initech',
          realm: 'ent-initech',
          fromVersion: 1,
          toVersion: 1,
          applied: false,
          differences: [],
          error: 'Keycloak diff failed (404)',
        },
        {
          slug: 'umbrella',
          realm: 'ent-umbrella',
          fromVersion: 1,
          toVersion: 1,
          applied: false,
          differences: [],
        },
      ],
    });
    expect(await upgradeEnterprise(d, { dryRun: true })).toBe(1);
    expect(err.join('\n')).toMatch(/ent-initech: could not be read \(Keycloak diff failed \(404\)\)/);
    expect(out.join('\n')).toMatch(/ent-umbrella: up to date/);
    expect(out.join('\n')).not.toMatch(/ent-initech: up to date/);
  });
});

describe('ops enterprise migrate', () => {
  const plan = {
    slug: 'globex',
    realm: 'ent-globex',
    members: [
      { email: 'owner@globex.test', role: 'owner' },
      { email: 'quiet@globex.test', role: null },
    ],
    invites: 1,
    companyLogins: [
      { alias: 'globex-corp', secretKept: true },
      { alias: 'old-corp', secretKept: false },
    ],
  };

  it('prints the plan of a dry run', async () => {
    const { d, out, api } = deps({ status: 200, body: plan });
    expect(await migrateEnterprise(d, { tenant: 'globex', dryRun: true })).toBe(0);
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'POST',
      '/api/platform/enterprise-tenants/migrate',
      {
        token: 'op-token',
        body: { slug: 'globex', dryRun: true },
      },
    );
    const text = out.join('\n');
    expect(text).toMatch(/globex would move to ent-globex \(dry run, nothing changed\)/);
    expect(text).toMatch(/owner@globex\.test: owner/);
    expect(text).toMatch(/quiet@globex\.test: no role/);
    expect(text).toMatch(/1 open invite/);
    expect(text).toMatch(/old-corp: no kept secret/);
  });
});

describe('ops enterprise idp-secret', () => {
  it('sends the secret it was given and never prints it', async () => {
    const { d, out, err, api } = deps({ status: 204, body: undefined });
    expect(
      await setIdpSecretCommand(d, { tenant: 'globex', alias: 'old-corp', secret: 's3cret-value' }),
    ).toBe(0);
    expect(api).toHaveBeenCalledWith(
      'tenantry.localhost',
      'PUT',
      '/api/platform/enterprise-tenants/globex/idps/old-corp/secret',
      { token: 'op-token', body: { secret: 's3cret-value' } },
    );
    expect([...out, ...err].join('\n')).not.toContain('s3cret-value');
    expect(out.join('\n')).toMatch(/old-corp signs people in again/);
  });
});

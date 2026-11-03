import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureProvisionerClient } from './provisioner.mjs';

// A Keycloak stand-in for the few admin calls the setup makes.
function fakeKeycloak({ exists = false } = {}) {
  const calls = [];
  const clients = exists ? [{ id: 'c1', clientId: 'tenantry-provisioner' }] : [];
  const roleMappings = exists ? ['create-realm'] : [];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    calls.push(`${init.method ?? 'GET'} ${u.pathname}`);
    if (u.pathname.endsWith('/token')) return json({ access_token: 'admin' });
    if (u.pathname === '/admin/realms/master/clients' && (init.method ?? 'GET') === 'GET')
      return json(clients);
    if (u.pathname === '/admin/realms/master/clients' && init.method === 'POST') {
      clients.push({ id: 'c1', clientId: JSON.parse(init.body).clientId });
      return new Response(null, { status: 201 });
    }
    if (u.pathname.endsWith('/service-account-user')) return json({ id: 'sa1' });
    if (u.pathname === '/admin/realms/master/roles/create-realm')
      return json({ id: 'r1', name: 'create-realm' });
    if (u.pathname.endsWith('/role-mappings/realm') && (init.method ?? 'GET') === 'GET')
      return json(roleMappings.map((name) => ({ name })));
    if (u.pathname.endsWith('/role-mappings/realm') && init.method === 'POST') {
      roleMappings.push('create-realm');
      return new Response(null, { status: 204 });
    }
    if (u.pathname.startsWith('/admin/realms/master/clients/c1') && init.method === 'PUT')
      return new Response(null, { status: 204 });
    return new Response('unexpected', { status: 500 });
  };
  return { fetchFn, calls };
}

const options = (fetchFn) => ({
  baseUrl: 'http://kc',
  adminUser: 'admin',
  adminPassword: 'pw',
  clientId: 'tenantry-provisioner',
  secret: 'dev-provisioner-secret',
  fetch: fetchFn,
});

test('creates the provisioner client with only create-realm', async () => {
  const kc = fakeKeycloak();
  assert.deepEqual(await ensureProvisionerClient(options(kc.fetchFn)), { created: true });
  assert.ok(kc.calls.includes('POST /admin/realms/master/clients'));
  assert.ok(kc.calls.includes('POST /admin/realms/master/users/sa1/role-mappings/realm'));
});

test('changes nothing the second time', async () => {
  const kc = fakeKeycloak({ exists: true });
  assert.deepEqual(await ensureProvisionerClient(options(kc.fetchFn)), { created: false });
  assert.ok(!kc.calls.some((c) => c.startsWith('POST /admin/realms/master/clients')));
  assert.ok(!kc.calls.some((c) => c.startsWith('POST') && c.endsWith('/role-mappings/realm')));
});

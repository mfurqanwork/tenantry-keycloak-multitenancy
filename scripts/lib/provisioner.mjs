// The master-realm account the API provisions enterprise realms with (ADR-0010): a confidential client
// whose service account holds only `create-realm`. Keycloak then gives it admin rights over the realms it
// creates, and nothing else. Created once with the bootstrap admin; dev only (production does it by hand).
export async function ensureProvisionerClient({
  baseUrl,
  adminUser,
  adminPassword,
  clientId,
  secret,
  fetch: doFetch = fetch,
}) {
  const tokenRes = await doFetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUser,
      password: adminPassword,
    }),
  });
  if (!tokenRes.ok) throw new Error(`bootstrap admin token: ${tokenRes.status}`);
  const { access_token: token } = await tokenRes.json();
  const admin = `${baseUrl}/admin/realms/master`;
  const call = async (method, path, body) => {
    const res = await doFetch(`${admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 || res.status === 201 ? null : res.json();
  };

  let [client] = await call('GET', `/clients?clientId=${encodeURIComponent(clientId)}`);
  const created = !client;
  if (!client) {
    await call('POST', '/clients', {
      clientId,
      name: 'Tenantry enterprise provisioning',
      publicClient: false,
      secret,
      serviceAccountsEnabled: true,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: false,
      implicitFlowEnabled: false,
    });
    [client] = await call('GET', `/clients?clientId=${encodeURIComponent(clientId)}`);
  }
  const user = await call('GET', `/clients/${client.id}/service-account-user`);
  const held = await call('GET', `/users/${user.id}/role-mappings/realm`);
  if (!held.some((role) => role.name === 'create-realm')) {
    const role = await call('GET', '/roles/create-realm');
    await call('POST', `/users/${user.id}/role-mappings/realm`, [role]);
  }
  return { created };
}

// The platform realm's tenantry-backend also reads company logins' settings (never their secrets), to copy
// them when a workspace moves to Enterprise (ADR-0025). A fresh Keycloak gets this from platform-realm.json;
// this brings a stack started before Phase 5b up to date. Dev only.
export async function ensureBackendRoles({ baseUrl, adminUser, adminPassword, fetch: doFetch = fetch }) {
  const wanted = ['view-identity-providers'];
  const tokenRes = await doFetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUser,
      password: adminPassword,
    }),
  });
  if (!tokenRes.ok) throw new Error(`bootstrap admin token: ${tokenRes.status}`);
  const { access_token: token } = await tokenRes.json();
  const admin = `${baseUrl}/admin/realms/platform`;
  const call = async (method, path, body) => {
    const res = await doFetch(`${admin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 || res.status === 201 ? null : res.json();
  };
  const [backend] = await call('GET', '/clients?clientId=tenantry-backend');
  const [management] = await call('GET', '/clients?clientId=realm-management');
  const user = await call('GET', `/clients/${backend.id}/service-account-user`);
  const mappings = `/users/${user.id}/role-mappings/clients/${management.id}`;
  const held = new Set((await call('GET', mappings)).map((r) => r.name));
  const roles = (await call('GET', `/clients/${management.id}/roles`)).filter(
    (r) => wanted.includes(r.name) && !held.has(r.name),
  );
  if (roles.length > 0) await call('POST', mappings, roles);
  return { added: roles.map((r) => r.name) };
}

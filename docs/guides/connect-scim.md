# Connect your directory (SCIM)

For owners of an **Enterprise** workspace. Your directory (Microsoft Entra ID, Okta, or any SCIM 2.0 client) creates, updates and deactivates the people in your workspace, and its groups give them roles. Standard workspaces do not have SCIM (ADR-0024).

## Get the address and a token

In the portal, open **Directory sync (SCIM)**.

- **SCIM address**: `https://<your-workspace>.<tenantry-domain>/scim/v2`. Copy it.
- **Generate token**: choose how long it lasts (90 days, 180 days or 1 year). The token starts with `tnt_scim_` and is **shown once**: copy it into your directory straight away. If it is lost, replace it.

The first token turns directory sync on. The page then shows when the token expires and when it was last used.

## Microsoft Entra ID

1. In Entra, open **Enterprise applications → New application → Create your own application** and choose "Integrate any other application you don't find in the gallery".
2. Open **Provisioning**, set **Provisioning Mode** to **Automatic**.
3. **Tenant URL**: the SCIM address. **Secret Token**: the token. Choose **Test Connection**.
4. Under **Mappings**, keep **userPrincipalName → userName** (or map `mail` if your people sign in with their email), **givenName → name.givenName**, **surname → name.familyName**, **mail → emails[type eq "work"].value**, and **Switch([IsSoftDeleted]…) → active**.
5. Assign the users and groups to provision, then **Start provisioning**.

Entra deactivates a person with a `PATCH` that sets `active` to the string `"False"`; Tenantry treats it as a deactivation.

## Okta

1. In Okta, add an app with **SCIM provisioning** (a SAML or OIDC app with "Enable SCIM provisioning", or the SCIM 2.0 test app).
2. **SCIM connector base URL**: the SCIM address. **Unique identifier field**: `userName`.
3. **Supported provisioning actions**: Push New Users, Push Profile Updates, Push Groups.
4. **Authentication Mode**: **HTTP Header**, and paste the token as the Bearer value.
5. Under **To App**, enable Create Users, Update User Attributes and Deactivate Users.

## Roles

- **Default role**: on the same page, choose the role people the directory creates get: **Member**, or **No role** (an invite or an admin then gives one). Tenantry grants it after each create or update of an active person.
- **Groups**: push a group named **`tenantry-members`** or **`tenantry-admins`** to give that role; a person in either gets it, and leaving takes it back. These two groups already exist in your workspace, so pushing them matches the existing group. Deleting one in the directory empties it rather than removing it.
- **Owners** are never managed by the directory: give and take the owner role in Tenantry.

## Deactivation

When the directory deactivates a person, Tenantry disables them in your workspace's realm: their sign-ins stop. A person the directory deletes is removed from the realm.

## Signing in

People the directory creates sign in with your company's identity provider if one is linked. If they sign in with a password instead, they set it through **Forgot password** and verify their email first.

## Replace or revoke the token

- **Replace token** makes a new one and stops the current one at once: update your directory straight after.
- **Revoke** stops the token at once and turns directory sync off. People the directory already made stay.

Every change is in the audit log: the token's creation and revocation (with its expiry, never the token), and each person and group the directory changed.

## Try it with curl

```bash
TOKEN=tnt_scim_...
SCIM=http://initech.tenantry.localhost/scim/v2
curl -s -H "Authorization: Bearer $TOKEN" "$SCIM/Users?count=5"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/scim+json" "$SCIM/Users" \
  -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"userName":"pat@initech.test","name":{"givenName":"Pat","familyName":"Doe"},"emails":[{"value":"pat@initech.test","primary":true}],"active":true}'
```

Errors come back as SCIM error bodies: 401 for a missing, wrong, revoked or expired token; 404 for an address that is not an enterprise workspace; 413 for a body over 1 MB; 502 when the identity service cannot be reached.

## Security settings

**Security** in the portal sets your realm's sign-in rules: two-step sign-in (off, optional, or required, which means an authenticator app), password length, history and expiry, session idle and maximum times, and lockout after failed attempts. Saving applies them to the next sign-in.

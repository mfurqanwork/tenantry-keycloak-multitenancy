# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](../../security/advisories/new) for this repository. Don't open a public issue. We aim to acknowledge reports within five working days.

## Supported versions

Until v1.0, only the `main` branch receives security fixes.

## Threat model in brief

Tenantry's main job is keeping tenants apart. The threats we design and test against:

- **Cross-tenant data access:** a user or a buggy query reading another tenant's rows. Countered by the auth guard plus forced row-level security.
- **Token confusion between realms:** a valid token from one realm accepted for another tenant. Countered by an exact issuer match per tenant.
- **Privilege escalation across organizations:** an admin in one organization acting as admin in another. Countered by reading roles only from the current organization's claim.
- **An over-powered provisioning credential:** the account that creates realms holds only `create-realm`; per-realm work uses per-realm credentials.
- **Secret leakage:** client secrets are shown once and never stored in our database; local secrets live in a gitignored `.env`.

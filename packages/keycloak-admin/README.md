# @tenantry/keycloak-admin

The only code that calls the Keycloak Admin and Organization APIs (ADR-0009, ADR-0017).

- `IdentityDirectory`: organizations, their `owners` / `admins` / `members` groups, members, invites, and tenant origins on the `tenantry-web` client.
- `createHttpIdentityDirectory(...)`: the real client, with a cached client-credentials token for the `tenantry-backend` service account. Only `apps/api/src/infrastructure` may build it.
- `@tenantry/keycloak-admin/testing`: `InMemoryIdentityDirectory` for unit tests.

`src/testing/contract.ts` is one test suite for both: `pnpm test` runs it on the fake and `pnpm test:isolation` on the running Keycloak.

Phase 3 adds realm provisioning (ADR-0010).

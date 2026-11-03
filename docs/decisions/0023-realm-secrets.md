# ADR-0023: Per-realm credentials live in a secrets store, not the database

Status: Accepted · Date: 2026-11-04

## Context

Each enterprise realm has a confidential `tenantry-backend` client. The API uses it to manage that realm's members (and, from Phase 4, its customer apps). The plan says this secret never goes in the database: a database dump, a read replica or a leaked backup must not give someone admin rights over every customer's realm.

## Decision

- `packages/keycloak-admin` defines `SecretStore` (`get`, `put`), keyed `<realm>/<name>`, for example `ent-initech/tenantry-backend`.
- Locally, `createFileSecretStore(TENANTRY_SECRETS_DIR)` keeps one JSON file per realm in a git-ignored folder (`.secrets/`). Writes are atomic, and files are readable by their owner only where the platform supports it. In Docker the API mounts that folder.
- Provisioning generates the secret (32 random bytes), stores it, then sets it on the realm's client. A rerun reuses the stored secret.
- The secret never appears in API responses, logs or audit metadata.
- A cloud secrets manager (AWS Secrets Manager, Azure Key Vault, Vault) can implement the same interface. That is Phase 6 work, with the deployment guide.

## Alternatives considered

- Encrypted in Postgres, with a key from the environment: one less moving part, but the key then sits next to the data it protects in most deployments, and the plan rules it out.
- Keycloak's own vault SPI: it covers secrets Keycloak reads, not ones our API reads.

## Consequences

- Losing the folder (or the cloud secret) means rotating each realm's backend secret. `pnpm ops enterprise provision` reruns do that when the stored secret is missing.
- Two API processes on different machines need a shared store. The file store suits one machine; Phase 6 brings the shared one.

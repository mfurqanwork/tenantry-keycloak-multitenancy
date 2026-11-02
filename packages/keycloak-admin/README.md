# @tenantry/keycloak-admin

The only code that calls the Keycloak Admin and Organization APIs (ADR-0009). It holds the provisioning client (create-realm only) and the per-realm `tenantry-backend` clients, and applies the versioned realm templates (ADR-0010).

Phase 1 adds organizations and members; Phase 3 adds realm provisioning.

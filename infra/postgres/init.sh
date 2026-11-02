#!/bin/bash
# Runs once, on an empty data volume.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<SQL
CREATE ROLE tenantry_owner LOGIN PASSWORD '${TENANTRY_OWNER_PASSWORD}';
CREATE ROLE tenantry_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${TENANTRY_APP_PASSWORD}';
CREATE DATABASE tenantry OWNER tenantry_owner;
CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE keycloak OWNER keycloak;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname tenantry <<SQL
ALTER SCHEMA public OWNER TO tenantry_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

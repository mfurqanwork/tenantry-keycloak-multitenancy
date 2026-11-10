#!/bin/bash
# The only thing the deploy key may run (ADR-0029). It takes a version and nothing else.
set -euo pipefail

version="${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Expected a version like 1.2.3." >&2
  exit 2
fi
if [[ -n "${TENANTRY_ENTRY_CHECK_ONLY:-}" ]]; then
  echo "ok $version"
  exit 0
fi

home=/opt/tenantry
raw="https://raw.githubusercontent.com/mfurqanwork/tenantry-keycloak-multitenancy/v$version"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$raw/infra/prod/compose.prod.yml" -o "$tmp/compose.prod.yml"
curl -fsSL "$raw/infra/prod/deploy.sh" -o "$tmp/deploy.sh"
curl -fsSL "$raw/infra/prod/reset.sh" -o "$tmp/reset.sh"
curl -fsSL "$raw/infra/prod/volumes.sh" -o "$tmp/volumes.sh"
curl -fsSL "$raw/infra/postgres/init.sh" -o "$tmp/init.sh"
chmod 755 "$tmp"/*.sh
cp "$tmp"/* "$home"/
exec "$home/deploy.sh" "$version"

#!/bin/bash
# Prepares a fresh Ubuntu VM once (docs/guides/deploy-azure.md). Safe to run again; it keeps an existing .env.
set -euo pipefail
if [[ "$(id -u)" != 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

raw=https://raw.githubusercontent.com/mfurqanwork/tenantry-keycloak-multitenancy/main
home=/opt/tenantry

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

id tenantry >/dev/null 2>&1 || useradd --create-home --shell /bin/bash tenantry
usermod -aG docker tenantry
mkdir -p "$home" /home/tenantry/.ssh
curl -fsSL "$raw/infra/prod/deploy-entry.sh" -o "$home/deploy-entry.sh"
chmod 755 "$home/deploy-entry.sh"

secret() { openssl rand -hex 24; }
if [[ ! -f "$home/.env" ]]; then
  cat >"$home/.env" <<EOF
TENANTRY_BASE_DOMAIN=tenantry.pengopal.com
TENANTRY_AUTH_URL=https://auth.tenantry.pengopal.com

# Fill these four in.
ACME_EMAIL=
CLOUDFLARE_API_TOKEN=
RESEND_API_KEY=
# The public demo password. It must match the TENANTRY_DEMO_PASSWORD variable in GitHub.
SEED_PASSWORD=

# A read:packages token, so this VM can pull the images.
GHCR_USER=mfurqanwork
GHCR_TOKEN=

POSTGRES_PASSWORD=$(secret)
TENANTRY_OWNER_PASSWORD=$(secret)
TENANTRY_APP_PASSWORD=$(secret)
KEYCLOAK_DB_PASSWORD=$(secret)
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=$(secret)
KEYCLOAK_BACKEND_CLIENT_SECRET=$(secret)
KEYCLOAK_OPS_CLIENT_SECRET=$(secret)
KEYCLOAK_PROVISIONER_CLIENT_SECRET=$(secret)
TENANTRY_ISOLATION_CLIENT_SECRET=$(secret)
CORP_DEMO_CLIENT_SECRET=$(secret)
EOF
  chmod 600 "$home/.env"
fi
chown -R tenantry:tenantry "$home" /home/tenantry/.ssh
chmod 700 "$home" /home/tenantry/.ssh

echo '0 3 * * * tenantry /opt/tenantry/reset.sh >>/opt/tenantry/reset.log 2>&1' >/etc/cron.d/tenantry-reset
chmod 644 /etc/cron.d/tenantry-reset

echo "Done. Next: edit $home/.env, then add the deploy key (see the guide)."

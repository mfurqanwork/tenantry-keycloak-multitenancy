#!/bin/bash
# Rebuilds the live demo from a release (ADR-0029): images, clean data, migrations, seed, baseline.
set -euo pipefail
version="$1"
source "$(dirname "$0")/volumes.sh"

exec 9>"$home/.lock"
flock 9

echo "TENANTRY_VERSION=$version" >"$home/release.env.new"
mv "$home/release.env.new" "$home/release.env"
set -a
source "$home/.env"
set +a
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-mfurqanwork}" --password-stdin
fi

# A failed pull stops here, with the running site untouched.
stack --profile tools pull --quiet

stack --profile tools down --remove-orphans
for name in "${data_volumes[@]}"; do docker volume rm -f "${project}_$name"; done
stack up -d --wait
stack run --rm ops

stack stop
take_baseline
stack up -d --wait
docker image prune -af --filter "until=168h" >/dev/null
echo "Tenantry $version is live."

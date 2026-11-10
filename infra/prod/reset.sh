#!/bin/bash
# The nightly reset (ADR-0029): back to the copy taken just after the last deploy's seed.
set -euo pipefail
source "$(dirname "$0")/volumes.sh"

exec 9>"$home/.lock"
flock 9

stack stop
restore_baseline
stack up -d --wait
echo "$(date -u +%FT%TZ) demo reset"

#!/bin/bash
# Shared by deploy.sh and reset.sh: the compose command, and the cold copy of the stack's data (ADR-0029).
home="${TENANTRY_HOME:-/opt/tenantry}"
project="${TENANTRY_PROJECT:-tenantry}"
compose_files=("${TENANTRY_COMPOSE_FILES[@]:-$home/compose.prod.yml}")
args=(compose --project-name "$project" --project-directory "$home" --env-file "$home/.env" --env-file "$home/release.env")
for file in "${compose_files[@]}"; do args+=(-f "$file"); done
stack() { docker "${args[@]}" "$@"; }

data_volumes=(pgdata secrets)
copier=alpine:3.22

take_baseline() {
  mkdir -p "$home/baseline"
  for name in "${data_volumes[@]}"; do
    docker run --rm -v "${project}_$name:/from:ro" -v "$home/baseline:/to" "$copier" \
      sh -c "tar czf /to/$name.tgz.new -C /from . && mv /to/$name.tgz.new /to/$name.tgz"
  done
}

restore_baseline() {
  for name in "${data_volumes[@]}"; do
    docker run --rm -v "${project}_$name:/to" -v "$home/baseline:/from:ro" "$copier" \
      sh -c "find /to -mindepth 1 -delete && tar xzpf /from/$name.tgz -C /to"
  done
}

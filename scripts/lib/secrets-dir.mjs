import { mkdirSync } from 'node:fs';

// The git-ignored secrets folder (ADR-0023) is bind-mounted into the API container. Docker makes a missing
// one as root, and the host user's `pnpm ops idp link` then cannot write to it, so it is made here first.
// On Linux and macOS the container also runs as the host user, so each side can read what the other wrote;
// Windows (Docker Desktop) has no such ids and needs neither. Tests pass null to stand in for Windows.
export function prepareSecretsDir(dir, { getuid = process.getuid, getgid = process.getgid } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!getuid || !getgid) return {};
  return { TENANTRY_UID: String(getuid()), TENANTRY_GID: String(getgid()) };
}

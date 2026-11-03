import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ExitCode } from '../deps.js';
import { upsertTxt } from '../dns/zone-file.js';

// Dev only: stands in for creating the record at a DNS provider. `reload` tells CoreDNS to read the
// zone again: through a Windows bind mount it does not notice the file change by itself.
export function setTxt(
  zonePath: string,
  name: string,
  value: string,
  out: (line: string) => void,
  reload: () => void,
): ExitCode {
  const current = existsSync(zonePath) ? readFileSync(zonePath, 'utf8') : '';
  writeFileSync(zonePath, upsertTxt(current, name, value));
  reload();
  out(`${name} TXT "${value}" is in the local DNS.`);
  return 0;
}

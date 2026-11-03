// The local DNS server's zone for .test (infra/dns), as text CoreDNS reloads when the serial rises.
// Dev only: a real company creates its TXT record with its own DNS provider.
export const EMPTY_ZONE = [
  '$ORIGIN test.',
  '@ 60 IN SOA ns.test. admin.test. 1 7200 3600 1209600 60',
  '@ 60 IN NS ns.test.',
  'ns 60 IN A 127.0.0.1',
  '',
].join('\n');

const SOA = /^(@ \d+ IN SOA \S+ \S+ )(\d+)( .*)$/m;

// Sets the one TXT record for `name` (replacing an earlier value) and raises the SOA serial.
export function upsertTxt(zone: string, name: string, value: string): string {
  const fqdn = name.toLowerCase().replace(/\.$/, '');
  if (!fqdn.endsWith('.test')) throw new Error(`${name} is not in the .test zone`);
  if (value.includes('"')) throw new Error('A TXT value cannot contain a double quote');
  const base = SOA.test(zone) ? zone : EMPTY_ZONE;
  const kept = base
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith(`${fqdn}. `))
    .map((line) =>
      line.replace(
        SOA,
        (_all, head: string, serial: string, tail: string) => `${head}${String(Number(serial) + 1)}${tail}`,
      ),
    );
  return [...kept, `${fqdn}. 60 IN TXT "${value}"`, ''].join('\n');
}

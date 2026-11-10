// In production the seed proves its own demo domain to itself: acme.test has no public DNS (ADR-0029).
export function memoryDns() {
  const records = new Map<string, string>();
  return {
    setTxt(name: string, value: string): void {
      records.set(name, value);
    },
    resolveTxt(name: string): Promise<string[]> {
      const value = records.get(name);
      return Promise.resolve(value === undefined ? [] : [value]);
    },
  };
}

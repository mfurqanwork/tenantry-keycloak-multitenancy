const NAME = /^[A-Z_][A-Z0-9_]*$/;

// A company's client secret comes from an environment variable (or .env), named on the command line, so
// it never lands in shell history or the process list.
export function secretFrom(name: string | undefined, read: (key: string) => string | undefined): string {
  const key = name ?? 'IDP_CLIENT_SECRET';
  if (!NAME.test(key)) throw new Error(`--client-secret-env takes a variable name like IDP_CLIENT_SECRET.`);
  const value = read(key);
  if (!value) throw new Error(`${key} is not set: put the identity provider's client secret in it.`);
  return value;
}

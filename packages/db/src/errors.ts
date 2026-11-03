export class SlugTakenError extends Error {
  override name = 'SlugTakenError';
  constructor(slug: string) {
    super(`The slug "${slug}" is taken`);
  }
}

export class OpenInviteExistsError extends Error {
  override name = 'OpenInviteExistsError';
  constructor(email: string) {
    super(`${email} already has an open invite`);
  }
}

export class DomainTakenError extends Error {
  override name = 'DomainTakenError';
  constructor(domain: string) {
    super(`${domain} is already verified by another workspace`);
  }
}

// Drizzle wraps driver errors; the Postgres error code sits on the error or its cause.
export function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e && typeof e === 'object' && 'code' in e ? e.code : undefined);
  const cause = err && typeof err === 'object' && 'cause' in err ? err.cause : undefined;
  return code(err) === '23505' || code(cause) === '23505';
}

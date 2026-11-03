// Any Keycloak admin call that did not do what was asked. `status` is the HTTP status (0 if none).
export class DirectoryError extends Error {
  override name = 'DirectoryError';
  constructor(
    readonly operation: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(`Keycloak ${operation} failed (${status})${detail ? `: ${detail}` : ''}`);
  }
}

// RFC 9457 problems. Throw these from anywhere; ProblemFilter writes them out. `extras` are the
// problem type's own members (RFC 9457 section 3.2), such as a suggested value.
export class Problem extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly extras: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = new.target.name;
  }

  get type(): string {
    return `https://tenantry.dev/problems/${this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
}

export class ValidationProblem extends Problem {
  constructor(detail: string, extras?: Record<string, unknown>) {
    super(422, 'Invalid request', detail, extras);
  }
}

export class UnauthorizedProblem extends Problem {
  constructor(detail = 'Sign in again.') {
    super(401, 'Unauthorized', detail);
  }
}

export class ForbiddenProblem extends Problem {
  constructor(detail = 'You do not have permission to do this.') {
    super(403, 'Forbidden', detail);
  }
}

export class NotFoundProblem extends Problem {
  constructor(detail = 'Not found.') {
    super(404, 'Not Found', detail);
  }
}

export class ConflictProblem extends Problem {
  constructor(detail: string) {
    super(409, 'Conflict', detail);
  }
}

export class BadGatewayProblem extends Problem {
  constructor(detail: string) {
    super(502, 'Bad Gateway', detail);
  }
}

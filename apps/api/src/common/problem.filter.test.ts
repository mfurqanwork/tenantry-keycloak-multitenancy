import { NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { DirectoryError } from '@tenantry/keycloak-admin';
import { describe, expect, it, vi } from 'vitest';
import { ConflictProblem } from './http-errors.js';
import { ProblemFilter } from './problem.filter.js';

function respond(err: unknown) {
  const res = { status: vi.fn(), type: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ProblemFilter().catch(err, host);
  return res;
}

describe('ProblemFilter', () => {
  it('writes a problem document for a Problem', () => {
    const res = respond(new ConflictProblem('Slug taken'));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    expect(res.json).toHaveBeenCalledWith({
      type: 'https://tenantry.dev/problems/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'Slug taken',
    });
  });

  it('answers 502 when Keycloak fails, without its message', () => {
    const res = respond(new DirectoryError('listMembers', 503, 'upstream secret detail'));
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bad Gateway',
        detail: 'The identity service is unavailable. Try again shortly.',
      }),
    );
  });

  it("maps Nest's own HTTP exceptions", () => {
    const res = respond(new NotFoundException());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404, title: 'Not Found' }));
  });

  it('hides the message of an unexpected error', () => {
    const res = respond(new Error('password=hunter2 in connection string'));
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0]?.[0] as { detail: string };
    expect(body.detail).not.toContain('hunter2');
  });
});

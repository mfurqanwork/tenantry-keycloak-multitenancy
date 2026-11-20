import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { DirectoryError } from '@tenantry/keycloak-admin';
import { describe, expect, it, vi } from 'vitest';
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

  it("doesn't echo the JSON parser's message for an unreadable body", () => {
    const res = respond(new BadRequestException("Expected property name or '}' in JSON at position 1"));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'The request could not be read.' }),
    );
  });

  it('hides the message of an unexpected error', () => {
    const res = respond(new Error('password=hunter2 in connection string'));
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0]?.[0] as { detail: string };
    expect(body.detail).not.toContain('hunter2');
  });
});

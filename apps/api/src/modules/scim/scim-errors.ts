import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

export const SCIM_ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';

// An error that leaves the gateway as a SCIM error body (RFC 7644 §3.12), never problem+json.
export class ScimError extends HttpException {
  constructor(status: number, detail: string) {
    super(detail, status);
  }
}

export function sendScimError(res: Response, status: number, detail: string): void {
  res
    .status(status)
    .type('application/scim+json')
    .send(JSON.stringify({ schemas: [SCIM_ERROR], status: String(status), detail }));
}

// Directory clients read SCIM errors; whatever fails on /scim/v2 answers in that shape.
@Catch()
export class ScimErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ScimGateway');

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof ScimError) {
      sendScimError(res, err.getStatus(), err.message);
      return;
    }
    if (err instanceof HttpException && err.getStatus() < 500) {
      sendScimError(res, err.getStatus(), err.message);
      return;
    }
    this.logger.error(err);
    sendScimError(res, 500, 'Something went wrong. Try again shortly.');
  }
}

import { RequestMethod, type INestApplication } from '@nestjs/common';
import { raw, type NextFunction, type Request, type Response } from 'express';
import { sendScimError } from './modules/scim/scim-errors.js';

export const SCIM_BODY_LIMIT = 1024 * 1024;

const scimBody = raw({ type: () => true, limit: SCIM_BODY_LIMIT });

// The routes and parsers every way of running the API shares (main.ts and the test app).
export function setUpHttp(app: INestApplication): void {
  // /scim/v2 is the directory's address, not under /api (ADR-0024).
  app.setGlobalPrefix('api', { exclude: [{ path: 'scim/v2/{*path}', method: RequestMethod.ALL }] });
  // Before Nest's JSON parser: the gateway passes the body on as bytes, whatever its type.
  app.use('/scim', (req: Request, res: Response, next: NextFunction) => {
    scimBody(req, res, (err?: unknown) => {
      if (!err) {
        next();
        return;
      }
      const status = (err as { status?: number }).status ?? 400;
      sendScimError(res, status, status === 413 ? 'The request body is over 1 MB.' : 'Unreadable body.');
    });
  });
}

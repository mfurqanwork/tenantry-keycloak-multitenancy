import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { DirectoryError } from '@tenantry/keycloak-admin';
import type { Response } from 'express';
import { BadGatewayProblem, Problem } from './http-errors.js';

// Every error leaves the API as application/problem+json. Unexpected errors never echo their message.
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(err: unknown, host: ArgumentsHost): void {
    const problem = this.toProblem(err);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json({
        ...problem.extras,
        type: problem.type,
        title: problem.title,
        status: problem.status,
        detail: problem.detail,
      });
  }

  private toProblem(err: unknown): Problem {
    if (err instanceof Problem) return err;
    // Keycloak is down or refused: our upstream failed, not us. Its message stays in the log.
    if (err instanceof DirectoryError) {
      this.logger.error(err);
      return new BadGatewayProblem('The identity service is unavailable. Try again shortly.');
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const title =
        status === 404 ? 'Not Found' : err.name.replace(/Exception$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
      return new Problem(status, title, err.message);
    }
    this.logger.error(err);
    return new Problem(500, 'Internal Server Error', 'Something went wrong. Try again later.');
  }
}

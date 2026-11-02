import type { LoggerOptions } from 'pino';

// Request logs carry headers; bearer tokens and session cookies must never reach them.
export function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  };
}

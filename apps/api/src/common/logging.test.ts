import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from './logging.js';

function capture(): { stream: Writable; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { stream, lines };
}

describe('loggerOptions', () => {
  it('never writes credentials from request headers to the log', () => {
    const { stream, lines } = capture();
    const logger = pino(loggerOptions('info'), stream);
    logger.info({
      req: {
        headers: { authorization: 'Bearer secret-token', cookie: 'KEYCLOAK_SESSION=abc', host: 'acme.x' },
      },
    });
    const line = lines.join('');
    expect(line).not.toContain('secret-token');
    expect(line).not.toContain('KEYCLOAK_SESSION=abc');
    expect(line).toContain('acme.x');
  });
});

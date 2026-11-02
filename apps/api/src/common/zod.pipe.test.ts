import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationProblem } from './http-errors.js';
import { ZodPipe } from './zod.pipe.js';

const pipe = new ZodPipe(z.object({ name: z.string().min(1), role: z.enum(['admin', 'member']) }));

describe('ZodPipe', () => {
  it('returns the parsed value', () => {
    expect(pipe.transform({ name: 'Apollo', role: 'admin', extra: 1 })).toEqual({
      name: 'Apollo',
      role: 'admin',
    });
  });

  it('refuses invalid input with a 422 naming each field', () => {
    let error: unknown;
    try {
      pipe.transform({ name: '', role: 'owner' });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ValidationProblem);
    expect((error as ValidationProblem).status).toBe(422);
    expect((error as ValidationProblem).detail).toMatch(/name/);
    expect((error as ValidationProblem).detail).toMatch(/role/);
  });
});

import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ValidationProblem } from './http-errors.js';

// @Body(new ZodPipe(schema)): the controller only ever sees parsed, typed input.
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    throw new ValidationProblem(issues.join('; '));
  }
}

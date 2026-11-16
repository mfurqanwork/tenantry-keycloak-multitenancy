import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/** A field's error, announced when it appears. Point the field's `aria-describedby` at its `id`. */
export function FieldError({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" data-slot="field-error" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
}

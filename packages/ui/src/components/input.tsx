import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

/** Shared by the text fields: the border, the focus ring and the invalid state. */
export const fieldClass = cn(
  'w-full min-w-0 rounded-md border border-input bg-background px-3 text-base transition-colors outline-none md:text-sm',
  'placeholder:text-muted-foreground focus-visible:border-ring focus-ring',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
  'dark:bg-muted/40',
);

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(fieldClass, 'h-9 py-1', className)} {...props} />;
}

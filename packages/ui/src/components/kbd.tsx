import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 items-center rounded-sm border border-border bg-muted px-1.5 font-mono text-[0.6875rem] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

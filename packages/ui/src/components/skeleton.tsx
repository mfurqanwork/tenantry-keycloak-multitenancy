import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

/** A placeholder while content loads. Pair it with a visible or screen-reader "Loading" message. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

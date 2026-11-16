import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

// The column every page pattern sits in.
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="page" className={cn('mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)}>
      {children}
    </div>
  );
}

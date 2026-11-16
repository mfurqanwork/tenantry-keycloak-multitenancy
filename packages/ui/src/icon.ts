import type { ComponentType } from 'react';

/** Any icon component: Lucide's, and Carbon's for the pages that still use it until they move (ADR-0031). */
export type IconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

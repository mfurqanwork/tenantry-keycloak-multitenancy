import type { ComponentType } from 'react';

/** Any icon component, such as Lucide's. */
export type IconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

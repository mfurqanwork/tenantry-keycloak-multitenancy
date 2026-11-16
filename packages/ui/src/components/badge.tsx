import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        primary: 'border-transparent bg-primary-subtle text-foreground',
        success: 'border-transparent bg-success-muted text-success',
        warning: 'border-transparent bg-warning-muted text-warning',
        danger: 'border-transparent bg-destructive-muted text-destructive',
        // Enterprise: navy ink framed by the opal mosaic, the brand's mark of the higher tier.
        opal: 'border-transparent bg-primary-subtle text-foreground ring-1 ring-link/40',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'opal';

export function Badge({ className, tone = 'neutral', ...props }: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return <span data-slot="badge" data-tone={tone} className={cn(badgeVariants({ tone }), className)} {...props} />;
}

import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap',
    'transition-colors outline-none select-none focus-ring',
    'disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // The workspace colour; Tenantry's navy with the opal frame where no workspace colour applies.
        primary: 'opal-frame bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border-border bg-background hover:bg-muted',
        ghost: 'hover:bg-muted aria-expanded:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:ring-destructive/40',
      },
      size: {
        sm: 'h-7 px-2.5 text-[0.8rem] pointer-coarse:min-h-11',
        md: 'h-9 px-3.5 pointer-coarse:min-h-11',
        icon: 'size-9 pointer-coarse:size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

interface BaseProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  variant?: NonNullable<Variants['variant']>;
  /** Renders the child element (a link, a router link) with the button's look. */
  asChild?: boolean;
}

/** A button. An icon-only button must say what it does: `size="icon"` requires `aria-label`. */
export type ButtonProps =
  | (BaseProps & { size: 'icon'; 'aria-label': string })
  | (BaseProps & { size?: 'sm' | 'md'; 'aria-label'?: string });

export function Button({ className, variant = 'primary', size = 'md', asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

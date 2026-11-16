import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

// A panel anchored to a button: for content that is read, not a list of commands (a menu is for those).
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  sideOffset = 6,
  align = 'center',
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        role="dialog"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 max-h-(--radix-popover-content-available-height) overflow-y-auto outline-none',
          'rounded-lg border border-border bg-popover text-popover-foreground shadow-raised',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

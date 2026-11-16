import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';
import { fieldClass } from './input.js';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(fieldClass, 'min-h-20 py-2', className)} {...props} />;
}

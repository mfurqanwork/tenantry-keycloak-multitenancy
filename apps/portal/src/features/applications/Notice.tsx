import { cn } from '@tenantry/ui';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  success: { icon: CircleCheck, box: 'border-success/40 bg-success-muted', mark: 'text-success' },
  warning: { icon: TriangleAlert, box: 'border-warning/40 bg-warning-muted', mark: 'text-warning' },
  error: { icon: CircleAlert, box: 'border-destructive/30 bg-destructive-muted', mark: 'text-destructive' },
} as const;

// A short outcome on the page: a title, an optional line under it, and anything to act on below.
export function Notice({
  tone,
  title,
  children,
  detail,
}: {
  tone: keyof typeof TONES;
  title: string;
  detail?: string | null | undefined;
  children?: ReactNode;
}) {
  const { icon: Icon, box, mark } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-xl border p-4 text-sm', box)}
    >
      <p className="flex items-start gap-2">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', mark)} />
        <span>
          <span className="font-medium">{title}</span>
          {detail && <span className="text-muted-foreground"> {detail}</span>}
        </span>
      </p>
      {children}
    </div>
  );
}

import { Cpu, Globe, PanelsTopLeft, Smartphone, type LucideIcon } from 'lucide-react';
import { cn } from '@tenantry/ui';
import type { AppType } from '@tenantry/auth';
import { TYPE_LABELS } from './api.js';

const ICONS: Record<AppType, LucideIcon> = {
  web: Globe,
  spa: PanelsTopLeft,
  native: Smartphone,
  m2m: Cpu,
};

// The icon for an app's type; decorative, since a label always says the type beside it.
export function AppTypeIcon({ type }: { type: AppType }) {
  const Icon = ICONS[type];
  return <Icon aria-hidden="true" data-type={type} className="size-4 shrink-0 text-muted-foreground" />;
}

// An app's type with its icon.
export function AppTypeLabel({ type, className }: { type: AppType; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <AppTypeIcon type={type} />
      <span>{TYPE_LABELS[type]}</span>
    </span>
  );
}

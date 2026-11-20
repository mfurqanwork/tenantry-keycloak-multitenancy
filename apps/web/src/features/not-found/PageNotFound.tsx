import { DashboardPage } from '@tenantry/ui';
import { ArrowLeft } from 'lucide-react';

// An address inside the welcome site or a workspace that no page answers.
export function PageNotFound({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <DashboardPage
      title="Page not found"
      description="There is no page at this address. It may have moved, or the link may be wrong."
      tiles={[]}
      activity={
        <a
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-link hover:underline"
          href={homeHref}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {homeLabel}
        </a>
      }
    />
  );
}

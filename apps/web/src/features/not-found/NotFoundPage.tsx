import { DashboardPage } from '@tenantry/ui';
import { ArrowLeft } from 'lucide-react';
import { GoToWorkspace } from '../welcome/GoToWorkspace.js';

// An address with no workspace behind it: unknown, failed or not yet created.
export function NotFoundPage({ signupUrl, baseDomain }: { signupUrl: string; baseDomain: string }) {
  return (
    <DashboardPage
      title="Workspace not found"
      description="There is no workspace at this address. Check it, or try another."
      tiles={[]}
      activity={
        <div className="flex max-w-md flex-col gap-5 rounded-xl border border-border bg-card p-5">
          <GoToWorkspace baseDomain={baseDomain} />
          <a className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-link hover:underline" href={signupUrl}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Go to the welcome page
          </a>
        </div>
      }
    />
  );
}

import { useWorkspaces } from '@tenantry/app-kit';
import { EmptyState, Page, PageHeader } from '@tenantry/ui';
import { ArrowUpRight, ShieldOff } from 'lucide-react';

// Admin is for owners and admins (ADR-0027); anyone else who opens it lands here, with the way back.
export function NotAllowedPage() {
  const web = useWorkspaces().find((w) => w.current)?.webUrl;
  return (
    <Page>
      <PageHeader title="You can't open Admin" icon={ShieldOff} />
      <EmptyState
        icon={ShieldOff}
        title="Owners and admins only"
        body="Owners and admins manage the workspace here. Ask one of them if you need a change."
        action={
          web ? (
            <a
              href={web}
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium text-link underline-offset-4 outline-none hover:underline"
            >
              Open Tenantry
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          ) : undefined
        }
      />
    </Page>
  );
}

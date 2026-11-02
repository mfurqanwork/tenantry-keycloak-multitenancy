import { PageHeader } from '@tenantry/ui';

// An address with no workspace behind it: unknown, failed or not yet created.
export function NotFoundPage({ signupUrl }: { signupUrl: string }) {
  return (
    <div className="tenantry-page">
      <PageHeader title="Workspace not found" />
      <div className="tenantry-page__body">
        <p>
          There is no workspace at this address. Check the address, or{' '}
          <a href={signupUrl}>create a workspace</a>.
        </p>
      </div>
    </div>
  );
}

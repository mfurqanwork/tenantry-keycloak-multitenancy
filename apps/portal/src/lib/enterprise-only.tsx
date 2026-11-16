import { useMe } from '@tenantry/app-kit';
import { EmptyState, Page, PageHeader, type IconComponent } from '@tenantry/ui';
import { Building2 } from 'lucide-react';

// What a Standard workspace sees on the Security and Directory sync pages (the API says the same).
export const ENTERPRISE_ONLY = 'Security settings and SCIM are available on Enterprise workspaces.';

// The page's own header over an empty state: nothing to change, so no save bar.
export function EnterpriseOnlyPage(header: { title: string; icon: IconComponent; description: string }) {
  const me = useMe();
  return (
    <Page>
      <PageHeader breadcrumbs={[{ label: me.tenant.name, href: '/' }]} {...header} />
      <EmptyState icon={Building2} title="Enterprise only" body={ENTERPRISE_ONLY} />
    </Page>
  );
}

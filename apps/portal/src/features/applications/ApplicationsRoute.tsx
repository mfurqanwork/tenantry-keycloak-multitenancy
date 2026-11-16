import { ApiErrorNotification, RouterLink, useMe, useResource } from '@tenantry/app-kit';
import {
  Button,
  EmptyState,
  ListPage,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tenantry/ui';
import { AppWindow, Plus } from 'lucide-react';
import { type AppView } from './api.js';
import { AppTypeLabel } from './AppTypeLabel.js';

const page = {
  title: 'Customer apps',
  icon: AppWindow,
  description: 'Your own apps that sign people in through this workspace.',
};

// Enterprise workspaces only (ADR-0011): the apps connected to the workspace's own sign-in.
export function ApplicationsRoute() {
  const me = useMe();
  if (me.tenant.tier !== 'enterprise') {
    return (
      <ListPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        {...page}
        isEmpty
        emptyState={
          <EmptyState icon={AppWindow} title="Enterprise only" body="Applications are available on Enterprise workspaces." />
        }
      >
        {null}
      </ListPage>
    );
  }
  return <EnterpriseApplications />;
}

function EnterpriseApplications() {
  const me = useMe();
  const list = useResource<{ apps: AppView[] }>('/api/apps');
  const apps = list.data?.apps ?? [];
  const registers = me.can('apps:register');
  return (
    <ListPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      {...page}
      primaryAction={
        registers ? (
          <Button asChild>
            <RouterLink href="/advanced/apps/new">
              <Plus aria-hidden="true" />
              Register an app
            </RouterLink>
          </Button>
        ) : undefined
      }
      isEmpty={list.data !== undefined && apps.length === 0}
      emptyState={
        <EmptyState
          icon={AppWindow}
          title="Connect your first app"
          body={registers ? 'Register one to connect it to your sign-in.' : 'Owners and admins register apps here.'}
        />
      }
    >
      <ApiErrorNotification error={list.error} />
      {!list.data && !list.error && <Skeleton className="h-40 w-full" />}
      {list.data && (
        <Table aria-label="Applications">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">
                  <RouterLink
                    href={`/advanced/apps/${app.id}`}
                    className="focus-ring rounded-sm text-link underline-offset-4 outline-none hover:underline"
                  >
                    {app.name}
                  </RouterLink>
                </TableCell>
                <TableCell>
                  <AppTypeLabel type={app.type} />
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{app.clientId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPage>
  );
}

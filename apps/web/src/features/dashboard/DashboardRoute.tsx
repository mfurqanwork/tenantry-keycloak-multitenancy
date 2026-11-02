import { Tile } from '@carbon/react';
import { DashboardPage } from '@tenantry/ui';

// The subdomain names the tenant (ADR-0005); Phase 1 checks it against the token.
export function tenantSlug(hostname: string): string {
  return hostname.split('.')[0] ?? '';
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile className="tenantry-stat">
      <p className="tenantry-stat__label">{label}</p>
      <p className="tenantry-stat__value">{value}</p>
    </Tile>
  );
}

export function DashboardRoute({ hostname }: { hostname: string }) {
  return (
    <DashboardPage
      title="Dashboard"
      tiles={[
        <StatTile key="tenant" label="Tenant" value={tenantSlug(hostname)} />,
        <StatTile key="realm" label="Realm" value="platform" />,
        <StatTile key="status" label="Status" value="Phase 0" />,
      ]}
    />
  );
}

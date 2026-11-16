import type { ScimDefaultRole } from '@tenantry/auth';
import { ApiErrorNotification, FormDialog, Loading, useApi, useMe, useResource } from '@tenantry/app-kit';
import {
  Button,
  CodeSnippet,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsPage,
  StatTile,
  TechLogo,
  TileGrid,
} from '@tenantry/ui';
import { CalendarClock, Clock, FolderSync, KeyRound, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ENTERPRISE_ONLY } from '../../lib/enterprise-only.js';

interface ScimView {
  url: string;
  token: { expiresAt: string; lastUsedAt: string | null; createdAt: string } | null;
  defaultRole: ScimDefaultRole;
}

type Days = 90 | 180 | 365;
const EXPIRIES: { days: Days; label: string }[] = [
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
  { days: 365, label: '1 year' },
];

const ROLES: { value: ScimDefaultRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'none', label: 'No role: an invite or an admin gives one' },
];

const date = (iso: string) => new Date(iso).toLocaleDateString();

const header = {
  title: 'Directory sync (SCIM)',
  icon: FolderSync,
  description: 'Keep people in step with Entra ID or Okta.',
};

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExpirySelect({ id, value, onChange }: { id: string; value: Days; onChange: (d: Days) => void }) {
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <Label htmlFor={id}>Token expires after</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          onChange(Number(next) as Days);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXPIRIES.map((e) => (
            <SelectItem key={e.days} value={String(e.days)}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// The workspace's directory sync (owners: tenant:settings): the address and token a directory such as
// Entra ID or Okta uses (ADR-0024), and the role the people it creates get.
export function ScimRoute() {
  const me = useMe();
  if (me.tenant.tier !== 'enterprise') {
    return (
      <SettingsPage
        breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
        {...header}
        dirty={false}
        saving={false}
        onSave={() => undefined}
        onDiscard={() => undefined}
      >
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{ENTERPRISE_ONLY}</p>
      </SettingsPage>
    );
  }
  return <EnterpriseScim />;
}

function EnterpriseScim() {
  const me = useMe();
  const api = useApi();
  const saved = useResource<ScimView>('/api/scim');
  const [days, setDays] = useState<Days>(90);
  const [role, setRole] = useState<ScimDefaultRole | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'replace' | 'revoke' | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const view = saved.data;
  const roleValue = role ?? view?.defaultRole ?? 'member';

  async function generate(expiresInDays: Days) {
    const { token } = await api.post<{ token: string }>('/api/scim/token', { expiresInDays });
    setSecret(token);
    saved.reload();
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      {...header}
      dirty={view !== undefined && roleValue !== view.defaultRole}
      saving={saving}
      onSave={() =>
        void run(async () => {
          setSaving(true);
          try {
            await api.put('/api/scim/default-role', { role: roleValue });
            saved.reload();
            setRole(null);
          } finally {
            setSaving(false);
          }
        })
      }
      onDiscard={() => {
        setRole(null);
      }}
    >
      <ApiErrorNotification error={saved.error ?? error} />
      {secret && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-muted p-4">
          <p className="flex items-start gap-2 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="font-medium">Copy the SCIM token now</span>{' '}
              <span className="text-muted-foreground">
                It won&apos;t be shown again. If it is lost, replace it with a new one.
              </span>
            </span>
          </p>
          <CodeSnippet label="SCIM token" className="bg-background">
            {secret}
          </CodeSnippet>
        </div>
      )}
      {!view && !saved.error && <Loading description="Loading directory sync" />}
      {view && (
        <>
          <Card id="scim-address" title="SCIM address">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              Works with
              <TechLogo name="entra" />
              <TechLogo name="okta" size={20} />
              and any SCIM 2.0 directory.
            </p>
            <CodeSnippet label="SCIM address">{view.url}</CodeSnippet>
          </Card>
          <Card id="scim-token" title="Token">
            {view.token ? (
              <>
                <TileGrid>
                  {[
                    <StatTile key="expires" icon={CalendarClock} label="Expires" value={date(view.token.expiresAt)} />,
                    <StatTile
                      key="used"
                      icon={Clock}
                      label="Last used"
                      value={view.token.lastUsedAt ? date(view.token.lastUsedAt) : 'Never'}
                    />,
                    <StatTile key="created" icon={KeyRound} label="Created" value={date(view.token.createdAt)} />,
                  ]}
                </TileGrid>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialog('replace');
                    }}
                  >
                    Replace token
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                    onClick={() => {
                      setDialog('revoke');
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No token yet. A directory needs one to sync people into this workspace.
                </p>
                <ExpirySelect id="scim-expiry" value={days} onChange={setDays} />
                <div>
                  <Button disabled={busy} onClick={() => void run(() => generate(days))}>
                    <KeyRound aria-hidden="true" />
                    Generate token
                  </Button>
                </div>
              </>
            )}
          </Card>
          <Card id="scim-role" title="New people">
            <div className="flex max-w-md flex-col gap-2">
              <Label htmlFor="scim-default-role">Role for people the directory creates</Label>
              <Select
                value={roleValue}
                onValueChange={(next) => {
                  setRole(next as ScimDefaultRole);
                }}
              >
                <SelectTrigger id="scim-default-role" aria-describedby="scim-default-role-help">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="scim-default-role-help" className="text-sm text-muted-foreground">
                Groups tenantry-members and tenantry-admins give their role on top. Owners are never managed by
                the directory.
              </p>
            </div>
          </Card>
        </>
      )}
      {dialog === 'replace' && (
        <FormDialog
          heading="Replace token"
          submitLabel="Replace token"
          danger
          canSubmit
          onSubmit={() => generate(days)}
          onClose={() => {
            setDialog(null);
          }}
        >
          <p className="text-sm">
            You get a new token, shown once. The current token stops working at once, so update your directory
            straight after.
          </p>
          <ExpirySelect id="scim-replace-expiry" value={days} onChange={setDays} />
        </FormDialog>
      )}
      {dialog === 'revoke' && (
        <FormDialog
          heading="Revoke token"
          submitLabel="Revoke token"
          danger
          canSubmit
          onSubmit={async () => {
            await api.del('/api/scim/token');
            setSecret(null);
            saved.reload();
          }}
          onClose={() => {
            setDialog(null);
          }}
        >
          <p className="text-sm">
            The token stops working at once and directory sync is turned off: your directory can no longer change
            people in this workspace. People it already made stay.
          </p>
        </FormDialog>
      )}
    </SettingsPage>
  );
}

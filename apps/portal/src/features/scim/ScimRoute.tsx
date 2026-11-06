import { DataShare } from '@carbon/icons-react';
import {
  Button,
  CodeSnippet,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  Tile,
} from '@carbon/react';
import type { ScimDefaultRole } from '@tenantry/auth';
import { ApiErrorNotification, FormDialog, useApi, useMe, useResource } from '@tenantry/app-kit';
import { SettingsPage, StatTile, TileGrid } from '@tenantry/ui';
import { useState } from 'react';
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

function ExpirySelect({ id, value, onChange }: { id: string; value: Days; onChange: (d: Days) => void }) {
  return (
    <Select
      id={id}
      labelText="Token expires after"
      value={String(value)}
      onChange={(event) => {
        onChange(Number(event.target.value) as Days);
      }}
    >
      {EXPIRIES.map((e) => (
        <SelectItem key={e.days} value={String(e.days)} text={e.label} />
      ))}
    </Select>
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
        title="Directory sync (SCIM)"
        icon={DataShare}
        description="Keep people in step with Entra ID or Okta."
        dirty={false}
        saving={false}
        onSave={() => undefined}
        onDiscard={() => undefined}
      >
        <Tile>{ENTERPRISE_ONLY}</Tile>
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
      title="Directory sync (SCIM)"
      icon={DataShare}
      description="Keep people in step with Entra ID or Okta."
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
      <Stack gap={6}>
        <ApiErrorNotification error={saved.error ?? error} />
        {secret && (
          <Stack gap={3}>
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Copy the SCIM token now"
              subtitle="It won't be shown again. If it is lost, replace it with a new one."
            />
            <CodeSnippet type="single" feedback="Copied" aria-label="SCIM token">
              {secret}
            </CodeSnippet>
          </Stack>
        )}
        {!view && !saved.error && <InlineLoading description="Loading directory sync" />}
        {view && (
          <>
            <section aria-label="SCIM address">
              <h2 className="tenantry-section__title">SCIM address</h2>
              <CodeSnippet type="single" feedback="Copied" aria-label="SCIM address">
                {view.url}
              </CodeSnippet>
            </section>
            <section aria-label="Token">
              <h2 className="tenantry-section__title">Token</h2>
              {view.token ? (
                <Stack gap={5}>
                  <TileGrid>
                    {[
                      <StatTile key="expires" label="Expires" value={date(view.token.expiresAt)} />,
                      <StatTile
                        key="used"
                        label="Last used"
                        value={view.token.lastUsedAt ? date(view.token.lastUsedAt) : 'Never'}
                      />,
                      <StatTile key="created" label="Created" value={date(view.token.createdAt)} />,
                    ]}
                  </TileGrid>
                  <Stack orientation="horizontal" gap={3}>
                    <Button
                      kind="tertiary"
                      onClick={() => {
                        setDialog('replace');
                      }}
                    >
                      Replace token
                    </Button>
                    <Button
                      kind="danger--ghost"
                      onClick={() => {
                        setDialog('revoke');
                      }}
                    >
                      Revoke
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack gap={5}>
                  <p>No token yet. A directory needs one to sync people into this workspace.</p>
                  <ExpirySelect id="scim-expiry" value={days} onChange={setDays} />
                  <div>
                    <Button kind="tertiary" disabled={busy} onClick={() => void run(() => generate(days))}>
                      Generate token
                    </Button>
                  </div>
                </Stack>
              )}
            </section>
            <Select
              id="scim-default-role"
              labelText="Role for people the directory creates"
              helperText="Groups tenantry-members and tenantry-admins give their role on top. Owners are never managed by the directory."
              value={roleValue}
              onChange={(event) => {
                setRole(event.target.value as ScimDefaultRole);
              }}
            >
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value} text={r.label} />
              ))}
            </Select>
          </>
        )}
      </Stack>
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
          <Stack gap={5}>
            <p>
              You get a new token, shown once. The current token stops working at once, so update your
              directory straight after.
            </p>
            <ExpirySelect id="scim-replace-expiry" value={days} onChange={setDays} />
          </Stack>
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
          <p>
            The token stops working at once and directory sync is turned off: your directory can no longer
            change people in this workspace. People it already made stay.
          </p>
        </FormDialog>
      )}
    </SettingsPage>
  );
}

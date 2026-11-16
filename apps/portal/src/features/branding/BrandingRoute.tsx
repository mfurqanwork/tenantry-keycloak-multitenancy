import { brandTokens } from '@tenantry/brand';
import {
  ApiErrorNotification,
  ApiProblem,
  Loading,
  useApi,
  useMe,
  useResource,
  type Branding,
} from '@tenantry/app-kit';
import { applyBrand, Button, FieldError, Input, Label, SettingsPage, TenantryMark } from '@tenantry/ui';
import { ImageUp, Palette, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO_MAX_BYTES = 262144;
const TOO_BIG = 'The logo must be 256 KB or smaller.';

// The workspace's colour and logo (owners: tenant:settings). The API refuses a colour that white text
// cannot sit on and suggests the nearest darker shade.
export function BrandingRoute({ onChanged }: { onChanged: () => void }) {
  const me = useMe();
  const api = useApi();
  const saved = useResource<Branding>(`/api/tenants/${encodeURIComponent(me.tenant.slug)}/branding`);
  const savedColor = saved.data?.primaryColor ?? '';
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const preview = useRef<HTMLDivElement>(null);

  const value = color ?? savedColor;
  const malformed = value !== '' && !HEX.test(value);
  const dirty = value.toLowerCase() !== savedColor && !malformed;

  // The preview shows the typed colour before it is saved; the rest of the page keeps the saved one.
  useEffect(() => {
    if (!preview.current) return;
    applyBrand(HEX.test(value) ? brandTokens(value) : null, preview.current);
  }, [value]);

  async function run(action: () => Promise<unknown>, busy: (on: boolean) => void) {
    busy(true);
    setError(null);
    setSuggestion(null);
    try {
      await action();
      saved.reload();
      onChanged();
      return true;
    } catch (err) {
      const suggested = err instanceof ApiProblem ? err.extras['suggestion'] : undefined;
      if (typeof suggested === 'string') setSuggestion(suggested);
      else setError(err);
      return false;
    } finally {
      busy(false);
    }
  }

  async function save() {
    if (await run(() => api.put('/api/branding', { primaryColor: value === '' ? null : value }), setSaving)) {
      setColor(null);
    }
  }

  function addLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      setError(new ApiProblem(413, 'Logo too large', TOO_BIG));
      return;
    }
    void run(() => api.upload('/api/branding/logo', 'file', file), setUploading);
  }

  return (
    <SettingsPage
      breadcrumbs={[{ label: me.tenant.name, href: '/' }]}
      title="Branding"
      icon={Palette}
      description="Your colour and logo, on the apps and the sign-in page."
      dirty={dirty}
      saving={saving}
      onSave={() => void save()}
      onDiscard={() => {
        setColor(null);
        setSuggestion(null);
      }}
    >
      <ApiErrorNotification error={saved.error ?? error} />
      {suggestion && (
        <div
          role="status"
          className="flex flex-wrap items-start gap-3 rounded-lg border border-warning/40 bg-warning-muted p-3 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="font-medium">This colour is too light for white text.</p>
            <p className="text-muted-foreground">{`Suggested: ${suggestion}`}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setColor(suggestion);
              setSuggestion(null);
            }}
          >
            Use this colour
          </Button>
        </div>
      )}

      <section aria-labelledby="branding-colour" className="grid gap-6 rounded-xl border border-border bg-card p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 id="branding-colour" className="text-base font-semibold">
            Colour
          </h2>
          <Label htmlFor="primary-colour">Primary colour</Label>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-9 shrink-0 rounded-md border border-border"
              style={{ background: HEX.test(value) ? value : 'transparent' }}
            />
            <Input
              id="primary-colour"
              placeholder="#0f62fe"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              value={value}
              aria-invalid={malformed}
              aria-describedby={malformed ? 'primary-colour-error' : 'primary-colour-help'}
              onChange={(event) => {
                setColor(event.target.value.trim());
              }}
            />
          </div>
          {malformed ? (
            <FieldError id="primary-colour-error">Use a colour like #0f62fe.</FieldError>
          ) : (
            <p id="primary-colour-help" className="text-sm text-muted-foreground">
              Buttons, links and focus use this colour. White text must be readable on it.
            </p>
          )}
        </div>

        {/* What people see: a button, a link and the sign-in card in the typed colour. */}
        <div
          ref={preview}
          role="group"
          aria-label="Preview"
          className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/40 p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary button</Button>
            <a
              href="#preview"
              className="text-sm text-link underline-offset-4 hover:underline"
              onClick={(event) => {
                event.preventDefault();
              }}
            >
              A link
            </a>
          </div>
          <div className="mx-auto flex w-full max-w-64 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-raised">
            <div className="flex items-center gap-2">
              {saved.data?.logoUrl ? (
                <img src={saved.data.logoUrl} alt="" className="h-6 w-auto" />
              ) : (
                <TenantryMark className="size-6" />
              )}
              <h3 className="text-sm font-semibold">{`Sign in to ${me.tenant.name}`}</h3>
            </div>
            <div aria-hidden="true" className="h-8 rounded-md border border-input bg-background" />
            <div aria-hidden="true" className="h-8 rounded-md bg-primary" />
          </div>
        </div>
      </section>

      <section aria-labelledby="branding-logo" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="branding-logo" className="text-base font-semibold">
          Logo
        </h2>
        {saved.data?.logoUrl && (
          <div className="flex items-center gap-4">
            <img src={saved.data.logoUrl} alt={`${me.tenant.name} logo`} className="h-12 w-auto" />
            <Button
              variant="ghost"
              disabled={uploading}
              onClick={() => void run(() => api.del('/api/branding/logo'), setUploading)}
            >
              Remove logo
            </Button>
          </div>
        )}
        {uploading ? (
          <Loading description="Uploading" />
        ) : (
          <label
            htmlFor="logo-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <ImageUp aria-hidden="true" className="size-6" />
            <span>
              <span className="font-medium text-foreground">Upload a logo</span> (PNG, JPEG or WebP, up to 256 KB)
            </span>
            <input
              id="logo-file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(event) => {
                addLogo(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
        )}
      </section>
    </SettingsPage>
  );
}

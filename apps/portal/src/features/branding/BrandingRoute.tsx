import { ColorPalette } from '@carbon/icons-react';
import {
  ActionableNotification,
  Button,
  FileUploaderDropContainer,
  InlineLoading,
  Link,
  Stack,
  TextInput,
} from '@carbon/react';
import { brandTokens } from '@tenantry/brand';
import {
  ApiErrorNotification,
  ApiProblem,
  useApi,
  useMe,
  useResource,
  type Branding,
} from '@tenantry/app-kit';
import { applyBrand, SettingsPage } from '@tenantry/ui';
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

  function addLogo(files: File[]) {
    const [file] = files;
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
      icon={ColorPalette}
      description="Your colour and logo, on the apps and the sign-in page."
      dirty={dirty}
      saving={saving}
      onSave={() => void save()}
      onDiscard={() => {
        setColor(null);
        setSuggestion(null);
      }}
    >
      <Stack gap={6}>
        <ApiErrorNotification error={saved.error ?? error} />
        {suggestion && (
          <ActionableNotification
            inline
            kind="warning"
            lowContrast
            hideCloseButton
            title="This colour is too light for white text."
            subtitle={`Suggested: ${suggestion}`}
            actionButtonLabel="Use this colour"
            onActionButtonClick={() => {
              setColor(suggestion);
              setSuggestion(null);
            }}
          />
        )}
        <TextInput
          id="primary-colour"
          labelText="Primary colour"
          helperText="Buttons, links and focus use this colour. White text must be readable on it."
          placeholder="#0f62fe"
          value={value}
          invalid={malformed}
          invalidText="Use a colour like #0f62fe."
          onChange={(event) => {
            setColor(event.target.value.trim());
          }}
        />
        <div ref={preview} className="tenantry-brand-preview" aria-label="Preview" role="group">
          <Button kind="primary">Primary button</Button>
          <Link
            href="#preview"
            onClick={(event) => {
              event.preventDefault();
            }}
          >
            A link
          </Link>
        </div>
        {saved.data?.logoUrl && (
          <div className="tenantry-brand-logo">
            <img src={saved.data.logoUrl} alt={`${me.tenant.name} logo`} />
            <Button
              kind="ghost"
              disabled={uploading}
              onClick={() => void run(() => api.del('/api/branding/logo'), setUploading)}
            >
              Remove logo
            </Button>
          </div>
        )}
        {uploading ? (
          <InlineLoading description="Uploading" />
        ) : (
          <FileUploaderDropContainer
            labelText="Drag and drop a logo here or click to upload (PNG, JPEG or WebP, up to 256 KB)"
            accept={['.png', '.jpg', '.jpeg', '.webp']}
            onAddFiles={(_event, { addedFiles }) => {
              addLogo(addedFiles);
            }}
          />
        )}
      </Stack>
    </SettingsPage>
  );
}

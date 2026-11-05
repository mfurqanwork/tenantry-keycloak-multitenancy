import { InlineLoading, Stack, TextInput } from '@carbon/react';
import { WizardPage } from '@tenantry/ui';
import { useState } from 'react';
import { ApiErrorNotification, useApi } from '@tenantry/app-kit';

type Availability = { available: true } | { available: false; reason: 'format' | 'reserved' | 'taken' };

const SLUG_MESSAGES: Record<'format' | 'reserved' | 'taken', string> = {
  format: 'Use 3–32 lowercase letters, digits or hyphens, starting with a letter.',
  reserved: 'This address is reserved.',
  taken: 'This address is taken.',
};

// One screen (Phase 6a): the review step only repeated the two fields.
const STEPS = ['Workspace'];

// "Acme Inc." → "acme-inc"
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
}

export function SignupRoute({
  baseDomain,
  onCreated,
}: {
  baseDomain: string;
  onCreated: (url: string) => void;
}) {
  const api = useApi();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Check the address, then create: one press. A taken or reserved address is shown on its field.
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.get<Availability>(
        `/api/signup/slug-availability?slug=${encodeURIComponent(slug)}`,
      );
      if (!result.available) {
        setSlugError(SLUG_MESSAGES[result.reason]);
        setBusy(false);
        return;
      }
      const created = await api.post<{ url: string }>('/api/signup', { name: name.trim(), slug });
      onCreated(created.url);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <WizardPage
      title="Create a workspace"
      steps={STEPS}
      currentStep={0}
      onNext={() => void create()}
      nextLabel="Create workspace"
      nextDisabled={busy || name.trim() === '' || slug === ''}
    >
      <Stack gap={6}>
        <ApiErrorNotification error={error} />
        <TextInput
          id="workspace-name"
          labelText="Workspace name"
          value={name}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestSlug(event.target.value));
            setSlugError(null);
          }}
        />
        <TextInput
          id="workspace-address"
          labelText="Address"
          helperText={slug ? `${slug}.${baseDomain}` : `your-name.${baseDomain}`}
          value={slug}
          maxLength={32}
          invalid={slugError !== null}
          invalidText={slugError ?? ''}
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setSlugEdited(true);
            setSlugError(null);
          }}
        />
        {busy && <InlineLoading description="Creating your workspace" />}
      </Stack>
    </WizardPage>
  );
}

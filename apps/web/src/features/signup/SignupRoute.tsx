import { ApiErrorNotification, Loading, useApi } from '@tenantry/app-kit';
import { FieldError, Input, Label, WizardPage } from '@tenantry/ui';
import { useState } from 'react';

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

  const preview = `${slug || 'your-name'}.${baseDomain}`;
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] justify-center bg-muted px-4 py-10 sm:py-16">
      <div data-slot="signup-card" className="h-fit w-full max-w-md">
        <WizardPage
          title="Create a workspace"
          description="Your team's own sign-in, people and brand."
          steps={STEPS}
          currentStep={0}
          onNext={() => void create()}
          nextLabel="Create workspace"
          nextDisabled={busy || name.trim() === '' || slug === ''}
          className="rounded-xl border border-border bg-card px-6 py-6 shadow-raised sm:px-8"
        >
          <ApiErrorNotification error={error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              maxLength={80}
              autoComplete="organization"
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(suggestSlug(event.target.value));
                setSlugError(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-address">Address</Label>
            <Input
              id="workspace-address"
              value={slug}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={slugError !== null}
              aria-describedby={slugError ? 'workspace-address-preview workspace-address-error' : 'workspace-address-preview'}
              onChange={(event) => {
                setSlug(event.target.value.toLowerCase());
                setSlugEdited(true);
                setSlugError(null);
              }}
            />
            <p id="workspace-address-preview" className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{preview}</span>
            </p>
            {slugError && <FieldError id="workspace-address-error">{slugError}</FieldError>}
          </div>
          {busy && <Loading description="Creating your workspace" />}
        </WizardPage>
      </div>
    </div>
  );
}

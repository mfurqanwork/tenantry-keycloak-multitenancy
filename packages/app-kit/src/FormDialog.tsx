import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@tenantry/ui';
import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { ApiErrorNotification } from './ApiErrorNotification.js';

// A dialog that runs one API call: the button stays disabled while it runs, a refusal is shown inside the
// dialog, and the dialog closes only on success.
export function FormDialog({
  heading,
  submitLabel,
  danger = false,
  canSubmit,
  onSubmit,
  onClose,
  children,
}: {
  heading: string;
  submitLabel: string;
  danger?: boolean;
  canSubmit: boolean;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(err);
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)} noValidate>
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
          </DialogHeader>
          <ApiErrorNotification error={error} />
          <div className="flex flex-col gap-4">{children}</div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? 'destructive' : 'primary'} disabled={!canSubmit || sending}>
              {sending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

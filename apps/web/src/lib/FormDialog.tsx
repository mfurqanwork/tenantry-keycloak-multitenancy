import { Modal, Stack } from '@carbon/react';
import { useState, type ReactNode } from 'react';
import { ApiErrorNotification } from './ApiErrorNotification.js';

// A Carbon modal that runs one API call: the button stays disabled while it runs, a refusal is shown
// inside the dialog, and the dialog closes only on success.
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

  async function submit() {
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
    <Modal
      open
      danger={danger}
      modalHeading={heading}
      primaryButtonText={submitLabel}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!canSubmit || sending}
      loadingStatus={sending ? 'active' : 'inactive'}
      loadingDescription="Sending"
      onRequestSubmit={() => void submit()}
      onRequestClose={onClose}
      size="sm"
    >
      <Stack gap={6}>
        <ApiErrorNotification error={error} />
        {children}
      </Stack>
    </Modal>
  );
}

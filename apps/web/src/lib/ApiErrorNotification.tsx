import { InlineNotification } from '@carbon/react';
import { ApiProblem } from './api.js';

// The one way a page shows a failed API call: the problem's title and detail, above the page body.
export function ApiErrorNotification({ error, onClose }: { error: unknown; onClose?: () => void }) {
  if (!error) return null;
  const problem =
    error instanceof ApiProblem ? error : new ApiProblem(0, 'Error', 'Something went wrong. Try again.');
  return (
    <InlineNotification
      kind="error"
      lowContrast
      title={problem.title}
      subtitle={problem.detail}
      hideCloseButton={!onClose}
      {...(onClose ? { onClose: () => (onClose(), false) } : {})}
    />
  );
}

import { CircleAlert, X } from 'lucide-react';
import { ApiProblem } from './api.js';

// The one way a page shows a failed API call: the problem's title and detail, above the page body.
export function ApiErrorNotification({ error, onClose }: { error: unknown; onClose?: () => void }) {
  if (!error) return null;
  const problem =
    error instanceof ApiProblem ? error : new ApiProblem(0, 'Error', 'Something went wrong. Try again.');
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-3 text-sm text-foreground"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">{problem.title}</p>
        {problem.detail && <p className="text-muted-foreground">{problem.detail}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

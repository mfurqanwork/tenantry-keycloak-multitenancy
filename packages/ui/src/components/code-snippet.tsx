import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/cn.js';
import { Button } from './button.js';

/**
 * A value to copy: an address, a token, a snippet. Mono text in a box with a copy button that says
 * "Copied" (to a screen reader too) for a moment after copying.
 */
export function CodeSnippet({
  label,
  children,
  multiline = false,
  className,
}: {
  label: string;
  children: string;
  multiline?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const code = <code className="font-mono text-sm break-all">{children}</code>;
  return (
    <div
      data-slot="code-snippet"
      role="group"
      aria-label={label}
      className={cn(
        'flex items-start gap-2 rounded-md border border-border bg-muted/60 py-1.5 pr-1.5 pl-3',
        className,
      )}
    >
      {multiline ? (
        <pre className="min-w-0 flex-1 overflow-x-auto py-1 whitespace-pre">{code}</pre>
      ) : (
        <div className="min-w-0 flex-1 py-1">{code}</div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
          });
        }}
      >
        {copied ? <Check aria-hidden="true" className="text-success" /> : <Copy aria-hidden="true" />}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </div>
  );
}

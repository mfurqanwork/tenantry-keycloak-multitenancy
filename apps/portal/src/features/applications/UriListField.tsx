import { APP_LIMITS } from '@tenantry/auth';
import { Button, FieldError, Input, Label } from '@tenantry/ui';
import { Plus, Trash2 } from 'lucide-react';

// One text field per URI, each with its own error, plus add and remove (ADR-0011: at most 10).
export function UriListField({
  id,
  label,
  helperText,
  values,
  problems,
  onChange,
}: {
  id: string;
  // Singular, as each field is named: "Redirect URI" → "Redirect URI 1".
  label: string;
  helperText?: string;
  values: string[];
  problems: (string | null)[];
  onChange: (values: string[]) => void;
}) {
  const rows = values.length === 0 ? [''] : values;
  // "Redirect URI" → "redirect URI", for the button labels.
  const noun = label.charAt(0).toLowerCase() + label.slice(1);
  const set = (i: number, value: string) => {
    onChange(rows.map((v, j) => (j === i ? value : v)));
  };
  return (
    <div className="flex flex-col gap-3">
      {rows.map((value, i) => {
        const field = `${id}-${String(i)}`;
        const problem = problems[i];
        const help = i === 0 && helperText ? `${field}-help` : undefined;
        return (
          <div key={i} className="flex flex-col gap-2">
            <Label htmlFor={field}>{`${label} ${String(i + 1)}`}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={field}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-sm"
                value={value}
                aria-invalid={Boolean(problem)}
                aria-describedby={problem ? `${field}-error` : help}
                onChange={(event) => {
                  set(i, event.target.value);
                }}
              />
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${noun} ${String(i + 1)}`}
                  onClick={() => {
                    onChange(rows.filter((_, j) => j !== i));
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
            {problem ? (
              <FieldError id={`${field}-error`}>{problem}</FieldError>
            ) : (
              help && (
                <p id={help} className="text-sm text-muted-foreground">
                  {helperText}
                </p>
              )
            )}
          </div>
        );
      })}
      {rows.length < APP_LIMITS.uris && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange([...rows, '']);
            }}
          >
            <Plus aria-hidden="true" />
            {`Add ${noun}`}
          </Button>
        </div>
      )}
    </div>
  );
}

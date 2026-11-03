import { Button, Stack, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { APP_LIMITS } from '@tenantry/auth';

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
    <Stack gap={3}>
      {rows.map((value, i) => (
        <Stack key={i} orientation="horizontal" gap={3}>
          <TextInput
            id={`${id}-${String(i)}`}
            labelText={`${label} ${String(i + 1)}`}
            {...(i === 0 && helperText ? { helperText } : {})}
            value={value}
            invalid={Boolean(problems[i])}
            invalidText={problems[i] ?? ''}
            onChange={(event) => {
              set(i, event.target.value);
            }}
          />
          {rows.length > 1 && (
            <Button
              kind="ghost"
              hasIconOnly
              renderIcon={TrashCan}
              iconDescription={`Remove ${noun} ${String(i + 1)}`}
              onClick={() => {
                onChange(rows.filter((_, j) => j !== i));
              }}
            />
          )}
        </Stack>
      ))}
      {rows.length < APP_LIMITS.uris && (
        <div>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Add}
            onClick={() => {
              onChange([...rows, '']);
            }}
          >
            {`Add ${noun}`}
          </Button>
        </div>
      )}
    </Stack>
  );
}

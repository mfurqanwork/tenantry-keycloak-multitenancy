import { Button, FieldError, Input, Label } from '@tenantry/ui';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { workspaceFromInput } from '../../lib/workspace-input.js';

// The address of a workspace on this base domain, on the port the page was opened on.
export function workspaceUrl(slug: string, baseDomain: string): string {
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${slug}.${baseDomain}${port}/`;
}

// "Go to your workspace": a name, address or pasted URL opens that workspace (the welcome and not-found pages).
export function GoToWorkspace({ baseDomain }: { baseDomain: string }) {
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const slug = workspaceFromInput(input, baseDomain);
        if (!slug) {
          setInvalid(true);
          return;
        }
        window.location.assign(workspaceUrl(slug, baseDomain));
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="go-to-workspace">Workspace address</Label>
        <div className="flex gap-2">
          <Input
            id="go-to-workspace"
            placeholder="pengopal"
            autoComplete="off"
            value={input}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'go-to-workspace-error' : undefined}
            onChange={(event) => {
              setInput(event.target.value);
              setInvalid(false);
            }}
          />
          <Button type="submit">
            Go
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        {invalid && (
          <FieldError id="go-to-workspace-error">Enter a workspace address, such as pengopal</FieldError>
        )}
      </div>
    </form>
  );
}

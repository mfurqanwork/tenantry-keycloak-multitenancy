import { Button, Stack, TextInput } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
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
      <Stack gap={5}>
        <TextInput
          id="go-to-workspace"
          labelText="Workspace address"
          placeholder="acme"
          value={input}
          invalid={invalid}
          invalidText="Enter a workspace address, such as acme"
          onChange={(event) => {
            setInput(event.target.value);
            setInvalid(false);
          }}
        />
        <Button type="submit" kind="primary" renderIcon={ArrowRight}>
          Go
        </Button>
      </Stack>
    </form>
  );
}

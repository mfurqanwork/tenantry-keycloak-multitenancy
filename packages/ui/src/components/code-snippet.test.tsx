import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeSnippet } from './code-snippet.js';

describe('CodeSnippet', () => {
  it('shows the value in mono and copies it, saying so', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<CodeSnippet label="SCIM token">tok_secret</CodeSnippet>);
    const code = screen.getByText('tok_secret');
    expect(code.tagName).toBe('CODE');
    expect(code.closest('[aria-label="SCIM token"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Copy SCIM token' }));
    expect(writeText).toHaveBeenCalledWith('tok_secret');
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('keeps several lines as they are', () => {
    render(<CodeSnippet label="Settings" multiline>{'a=1\nb=2'}</CodeSnippet>);
    expect(screen.getByText(/a=1/).closest('pre')).not.toBeNull();
  });
});

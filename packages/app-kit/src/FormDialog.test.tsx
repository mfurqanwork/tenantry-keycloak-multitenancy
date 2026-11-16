import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiProblem } from './api.js';
import { FormDialog } from './FormDialog.js';

function dialog(onSubmit: () => Promise<void>, onClose = vi.fn(), canSubmit = true) {
  render(
    <FormDialog
      heading="Invite someone"
      submitLabel="Send invite"
      canSubmit={canSubmit}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <label>
        Email
        <input name="email" />
      </label>
    </FormDialog>,
  );
  return { onClose, user: userEvent.setup() };
}

describe('FormDialog', () => {
  it('submits, then closes on success', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const { onClose, user } = dialog(onSubmit);
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('keeps the button disabled until the form can be sent', () => {
    dialog(
      vi.fn(() => Promise.resolve()),
      vi.fn(),
      false,
    );
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeDisabled();
  });

  it('shows a refusal inside the dialog and stays open', async () => {
    const { onClose, user } = dialog(() =>
      Promise.reject(new ApiProblem(409, 'Already a member', 'Ada is already here.')),
    );
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ada is already here.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });

  it('Cancel and Escape close it', async () => {
    const { onClose, user } = dialog(vi.fn(() => Promise.resolve()));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

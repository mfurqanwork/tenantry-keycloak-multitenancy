import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiProblem } from './api.js';
import { ApiErrorNotification } from './ApiErrorNotification.js';
import { FormDialog } from './FormDialog.js';

function dialog(onSubmit: () => Promise<void>, onClose = vi.fn(), canSubmit = true) {
  render(
    <FormDialog heading="Invite someone" submitLabel="Send invite" canSubmit={canSubmit} onSubmit={onSubmit} onClose={onClose}>
      <label>
        Email
        <input name="email" />
      </label>
    </FormDialog>,
  );
  return { onClose, user: userEvent.setup() };
}

describe('FormDialog', () => {
  it('is a dialog named by its heading, with the form inside', () => {
    dialog(vi.fn(() => Promise.resolve()));
    const box = screen.getByRole('dialog', { name: 'Invite someone' });
    expect(box).toContainElement(screen.getByRole('textbox', { name: 'Email' }));
  });

  it('submits, then closes on success', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const { onClose, user } = dialog(onSubmit);
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('submits on Enter in a field', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const { user } = dialog(onSubmit);
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.test{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('keeps the button disabled until the form can be sent', () => {
    dialog(vi.fn(() => Promise.resolve()), vi.fn(), false);
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeDisabled();
  });

  it('shows a refusal inside the dialog and stays open', async () => {
    const { onClose, user } = dialog(() => Promise.reject(new ApiProblem(409, 'Already a member', 'Ada is already here.')));
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ada is already here.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });

  it('disables the button while sending', async () => {
    let finish: () => void = () => undefined;
    const { user } = dialog(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(screen.getByRole('button', { name: /Send invite/ })).toBeDisabled();
    finish();
  });

  it('says it is sending, for a screen reader too', async () => {
    let finish: () => void = () => undefined;
    const { user } = dialog(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sending');
    expect(screen.getByRole('dialog').querySelector('form')).toHaveAttribute('aria-busy', 'true');
    finish();
  });

  it('Cancel and Escape close it', async () => {
    const { onClose, user } = dialog(vi.fn(() => Promise.resolve()));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ApiErrorNotification', () => {
  it("shows the problem's title and detail as an alert", () => {
    render(<ApiErrorNotification error={new ApiProblem(403, 'Not allowed', 'Only owners can do this.')} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Not allowed');
    expect(alert).toHaveTextContent('Only owners can do this.');
  });

  it('shows a general message for an unknown error, and nothing without one', () => {
    const { rerender } = render(<ApiErrorNotification error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    rerender(<ApiErrorNotification error={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('can be dismissed when it offers to', async () => {
    const onClose = vi.fn();
    render(<ApiErrorNotification error={new ApiProblem(500, 'Server error', 'Try again.')} onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalled();
  });
});

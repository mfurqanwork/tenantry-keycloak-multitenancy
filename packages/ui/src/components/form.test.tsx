import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import { FieldError } from './field-error.js';
import { Input } from './input.js';
import { Label } from './label.js';
import { RadioGroup, RadioGroupItem } from './radio-group.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.js';
import { Switch } from './switch.js';
import { Textarea } from './textarea.js';

describe('Button', () => {
  it('is primary by default, framed in opal unless a workspace colour applies', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveClass('opal-frame');
  });

  it('only the primary variant carries the frame', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('opal-frame');
  });

  it('a disabled button does not click', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('an icon button is named by its label', () => {
    render(
      <Button size="icon" aria-label="Delete">
        <Trash2 />
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('an icon button without a label does not compile', () => {
    // @ts-expect-error size="icon" requires aria-label
    const unnamed = <Button size="icon" />;
    expect(unnamed).toBeTruthy();
  });

  it('asChild renders the child element with button styles', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/docs">Docs</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('data-variant', 'secondary');
  });
});

describe('fields', () => {
  it('a label names its input', () => {
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input id="name" />
      </>,
    );
    expect(screen.getByLabelText('Name')).toBeInstanceOf(HTMLInputElement);
  });

  it('a label names its textarea', () => {
    render(
      <>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" />
      </>,
    );
    expect(screen.getByLabelText('Notes')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('a field error is announced', () => {
    render(<FieldError id="name-error">Enter a name</FieldError>);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-error');
  });
});

describe('choices', () => {
  it('a switch toggles with the space bar', async () => {
    render(<Switch aria-label="Require two-step sign-in" />);
    const toggle = screen.getByRole('switch', { name: 'Require two-step sign-in' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    toggle.focus();
    await userEvent.keyboard('[Space]');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('a checkbox toggles on click', async () => {
    render(<Checkbox aria-label="Remember me" />);
    const box = screen.getByRole('checkbox', { name: 'Remember me' });
    await userEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('a radio group reports the chosen value', async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Tier" defaultValue="standard" onValueChange={onValueChange}>
        <RadioGroupItem value="standard" aria-label="Standard" />
        <RadioGroupItem value="enterprise" aria-label="Enterprise" />
      </RadioGroup>,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Enterprise' }));
    expect(onValueChange).toHaveBeenCalledWith('enterprise');
    expect(screen.getByRole('radio', { name: 'Enterprise' })).toBeChecked();
  });

  it('a select opens from the keyboard and reports the chosen value', async () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Role">
          <SelectValue placeholder="Choose a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>,
    );
    screen.getByRole('combobox', { name: 'Role' }).focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    expect(onValueChange).toHaveBeenCalledWith('admin');
  });
});

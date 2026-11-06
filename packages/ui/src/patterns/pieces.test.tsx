import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Folder, Rocket } from '@carbon/icons-react';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar.js';
import { EmptyState } from './EmptyState.js';
import { PageHeader } from './PageHeader.js';
import { SetupCard } from './SetupCard.js';
import { StatTile } from './tiles.js';

describe('shared pieces (spec §8.2)', () => {
  it('EmptyState: an icon, a headline, one line and an action', () => {
    render(
      <EmptyState
        icon={Folder}
        title="Start your first project"
        body="Projects keep your team's work in one place."
        action={<button type="button">Create project</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Start your first project' })).toBeInTheDocument();
    expect(screen.getByText("Projects keep your team's work in one place.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('SetupCard: how many steps are done, a progress bar, and each step', async () => {
    const onHide = vi.fn();
    render(
      <SetupCard
        title="Finish setting up"
        icon={Rocket}
        onHide={onHide}
        steps={[
          { label: 'Create a project', done: false, content: <p>create here</p> },
          { label: 'Invite a teammate', done: true, content: null },
          { label: 'Add your colour and logo', done: true, content: null },
        ]}
      />,
    );
    expect(screen.getByText('2 of 3 done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText('create here')).toBeInTheDocument();
    expect(screen.getByText('Invite a teammate').closest('[data-done]')).toHaveAttribute('data-done', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide' }));
    expect(onHide).toHaveBeenCalled();
  });

  it('SetupCard: nothing once every step is done', () => {
    const { container } = render(
      <SetupCard title="Finish setting up" steps={[{ label: 'One', done: true, content: null }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['Ada Acme', 'AA'],
    ['ada@example.test', 'AD'],
    ['Cher', 'CH'],
    ['', '?'],
  ])('Avatar(%j) shows %s', (name, initials) => {
    render(<Avatar name={name} />);
    expect(screen.getByText(initials)).toBeInTheDocument();
  });

  it('PageHeader: an icon before the title, hidden from screen readers', () => {
    render(<PageHeader title="People" icon={Folder} description="Who is in this workspace." />);
    const title = screen.getByRole('heading', { level: 1, name: 'People' });
    expect(title.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Who is in this workspace.')).toBeInTheDocument();
  });

  it('StatTile: an optional icon above the number', () => {
    render(<StatTile label="Projects" value={3} icon={Folder} />);
    expect(screen.getByText('Projects').closest('.tenantry-stat')?.querySelector('svg')).not.toBeNull();
  });
});

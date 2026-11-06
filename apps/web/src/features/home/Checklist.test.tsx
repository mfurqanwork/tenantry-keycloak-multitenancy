import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL, fakeApi, makeMe, renderPage } from '../../test-utils.js';
import { Checklist, type ChecklistProps } from './Checklist.js';

const KEY = 'tenantry.checklist.hidden.u-me.acme';

function show(overrides: Partial<ChecklistProps> = {}) {
  const props: ChecklistProps = {
    done: { project: false, invite: false, brand: false },
    inviteUrl: 'http://acme.portal.tenantry.localhost/people?invite=1',
    brandingUrl: 'http://acme.portal.tenantry.localhost/branding',
    onCreateProject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  renderPage(<Checklist {...props} />, { api: fakeApi(), me: makeMe('owner', ALL) });
  return props;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the getting-started checklist', () => {
  it('lists the three steps with their actions', () => {
    show();
    expect(screen.getByText('Create a project')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite a teammate' })).toHaveAttribute(
      'href',
      'http://acme.portal.tenantry.localhost/people?invite=1',
    );
    expect(screen.getByRole('link', { name: 'Add your colour and logo' })).toHaveAttribute(
      'href',
      'http://acme.portal.tenantry.localhost/branding',
    );
  });

  it('shows a done step with a check mark and no action', () => {
    show({ done: { project: false, invite: true, brand: false } });
    expect(screen.queryByRole('link', { name: 'Invite a teammate' })).not.toBeInTheDocument();
    expect(screen.getByText('Invite a teammate').closest('li')).toHaveAttribute('data-done', 'true');
  });

  it('renders nothing once every step is done', () => {
    show({ done: { project: true, invite: true, brand: true } });
    expect(screen.queryByRole('region', { name: 'Finish setting up' })).not.toBeInTheDocument();
  });

  it('creates a project from its name', async () => {
    const props = show();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Project name'), 'Launch{Enter}');
    expect(props.onCreateProject).toHaveBeenCalledWith('Launch');
  });

  it('Hide puts it away and remembers that in this browser', async () => {
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('region', { name: 'Finish setting up' })).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('stays hidden on the next visit', () => {
    localStorage.setItem(KEY, '1');
    show();
    expect(screen.queryByRole('region', { name: 'Finish setting up' })).not.toBeInTheDocument();
  });

  it('still works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show();
    expect(screen.getByRole('region', { name: 'Finish setting up' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('region', { name: 'Finish setting up' })).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage.js';
import { DetailPage } from './DetailPage.js';
import { ListPage } from './ListPage.js';
import { SettingsPage } from './SettingsPage.js';
import { WizardPage } from './WizardPage.js';

const crumbs = [{ label: 'Home', href: '/' }];

describe('page patterns', () => {
  it.each([
    [
      'ListPage',
      <ListPage key="l" title="Members" isEmpty={false} emptyState={null}>
        rows
      </ListPage>,
    ],
    [
      'DetailPage',
      <DetailPage key="d" title="Acme" summary="s" tabs={[{ label: 'Overview', content: 'o' }]} />,
    ],
    [
      'SettingsPage',
      <SettingsPage
        key="s"
        title="Settings"
        dirty={false}
        saving={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
      >
        f
      </SettingsPage>,
    ],
    ['DashboardPage', <DashboardPage key="b" title="Dashboard" tiles={['a']} />],
    [
      'WizardPage',
      <WizardPage key="w" title="Sign up" steps={['One']} currentStep={0} onNext={vi.fn()}>
        c
      </WizardPage>,
    ],
  ])('%s renders its title as the only h1', (_name, element) => {
    render(element);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows breadcrumbs above the title', () => {
    render(
      <ListPage breadcrumbs={crumbs} title="Members" isEmpty={false} emptyState={null}>
        rows
      </ListPage>,
    );
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toHaveTextContent('Home');
  });

  it('ListPage shows the empty state instead of the rows when empty', () => {
    render(
      <ListPage title="Members" isEmpty emptyState={<p>No members yet</p>}>
        rows
      </ListPage>,
    );
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.queryByText('rows')).toBeNull();
  });

  it('SettingsPage disables Save until something changed', () => {
    render(
      <SettingsPage title="Settings" dirty={false} saving={false} onSave={vi.fn()} onDiscard={vi.fn()}>
        f
      </SettingsPage>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('SettingsPage saves when dirty', async () => {
    const onSave = vi.fn();
    render(
      <SettingsPage title="Settings" dirty saving={false} onSave={onSave} onDiscard={vi.fn()}>
        f
      </SettingsPage>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('WizardPage marks the current step and advances on Next', async () => {
    const onNext = vi.fn();
    render(
      <WizardPage title="Sign up" steps={['Account', 'Tenant', 'Done']} currentStep={1} onNext={onNext}>
        c
      </WizardPage>,
    );
    const current = screen.getByText('Tenant').closest('li');
    expect(current).toHaveClass('cds--progress-step--current');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('DetailPage shows the summary and tabs', () => {
    render(
      <DetailPage
        title="Acme"
        summary={<p>Summary</p>}
        tabs={[
          { label: 'Overview', content: 'o' },
          { label: 'Members', content: 'm' },
        ]}
      />,
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it.each([
    [
      'DashboardPage',
      <DashboardPage
        key="b"
        breadcrumbs={crumbs}
        title="Dashboard"
        actions={<button>Act</button>}
        tiles={['a']}
      />,
    ],
    [
      'WizardPage',
      <WizardPage
        key="w"
        breadcrumbs={crumbs}
        title="Sign up"
        actions={<button>Act</button>}
        steps={['One']}
        currentStep={0}
        onNext={vi.fn()}
      >
        c
      </WizardPage>,
    ],
  ])('%s shows breadcrumbs and header actions like the other patterns', (_name, element) => {
    render(element);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toHaveTextContent('Home');
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });

  it('WizardPage shows progress only for two or more steps', () => {
    const { container, rerender } = render(
      <WizardPage
        title="Create a workspace"
        steps={['Workspace']}
        currentStep={0}
        onNext={vi.fn()}
        nextLabel="Create workspace"
      >
        c
      </WizardPage>,
    );
    expect(container.querySelector('.cds--progress')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeInTheDocument();
    rerender(
      <WizardPage title="Register" steps={['Type', 'Review']} currentStep={0} onNext={vi.fn()}>
        c
      </WizardPage>,
    );
    expect(container.querySelector('.cds--progress')).not.toBeNull();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu.js';
import { Kbd } from './kbd.js';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet.js';
import { Skeleton } from './skeleton.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';

describe('Dialog', () => {
  it('moves focus inside, closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Invite</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email.</DialogDescription>
          <input aria-label="Email" />
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Invite' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Invite someone' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('has a close button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
          <DialogDescription>More.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('DropdownMenu', () => {
  it('arrow keys move between items', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Change role</DropdownMenuItem>
          <DropdownMenuItem>Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    screen.getByRole('button', { name: 'Actions' }).focus();
    await user.keyboard('{Enter}');
    const items = await screen.findAllByRole('menuitem');
    await waitFor(() => {
      expect(items[0]).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
  });
});

describe('Tabs', () => {
  it('arrow right selects the next tab', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview body</TabsContent>
        <TabsContent value="settings">Settings body</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Settings body');
  });
});

describe('Sheet', () => {
  it('opens as a dialog and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" aria-label="Open menu">
            ≡
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
          <a href="/home">Home</a>
        </SheetContent>
      </Sheet>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});

describe('display', () => {
  it('a badge shows its text and tone', () => {
    render(<Badge tone="opal">Enterprise</Badge>);
    expect(screen.getByText('Enterprise')).toHaveAttribute('data-tone', 'opal');
  });

  it('a table keeps table semantics', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });

  it('a skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('kbd renders a key', () => {
    render(<Kbd>Ctrl K</Kbd>);
    expect(screen.getByText('Ctrl K').tagName).toBe('KBD');
  });
});

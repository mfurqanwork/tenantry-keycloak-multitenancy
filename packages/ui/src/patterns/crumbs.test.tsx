import { render, screen } from '@testing-library/react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../shell/AppShell.js';
import { TenantryThemeProvider } from '../theme/ThemeProvider.js';
import { ListPage } from './ListPage.js';

const FakeRouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function FakeRouterLink(props, ref) {
    return <a ref={ref} data-router-link="" {...props} />;
  },
);

describe('page breadcrumbs', () => {
  it("go through the shell's router link, so they do not reload the page", () => {
    render(
      <TenantryThemeProvider>
        <AppShell productName="Tenantry" navItems={[]} currentPath="/members" linkAs={FakeRouterLink}>
          <ListPage breadcrumbs={[{ label: 'Acme', href: '/' }]} title="Members" isEmpty={false}>
            <p>rows</p>
          </ListPage>
        </AppShell>
      </TenantryThemeProvider>,
    );
    const crumb = screen.getByRole('link', { name: 'Acme', hidden: false });
    expect(crumb).toHaveAttribute('data-router-link');
    expect(crumb).toHaveAttribute('href', '/');
  });
});

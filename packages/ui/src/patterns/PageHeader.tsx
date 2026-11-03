import { Breadcrumb, BreadcrumbItem } from '@carbon/react';
import type { ReactNode } from 'react';
import { useRouterLink } from '../shell/link-context.js';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: Crumb[] | undefined;
  title: string;
  actions?: ReactNode;
}

// Shared by all five page patterns: breadcrumb, the page's only h1, then its actions at the end.
export function PageHeader({ breadcrumbs, title, actions }: PageHeaderProps) {
  const RouterLink = useRouterLink();
  return (
    <div className="tenantry-page-header">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb noTrailingSlash>
          {breadcrumbs.map((crumb) => (
            <BreadcrumbItem key={crumb.label} {...(crumb.href && !RouterLink ? { href: crumb.href } : {})}>
              {crumb.href && RouterLink ? (
                <RouterLink href={crumb.href}>{crumb.label}</RouterLink>
              ) : (
                crumb.label
              )}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      <div className="tenantry-page-header__row">
        <h1 className="tenantry-page-header__title">{title}</h1>
        {actions && <div className="tenantry-page-header__actions">{actions}</div>}
      </div>
    </div>
  );
}

import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import type { IconComponent } from '../icon.js';
import { useRouterLink } from '../shell/link-context.js';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: Crumb[] | undefined;
  title: string;
  actions?: ReactNode;
  // One line under the title, saying what the page is for.
  description?: ReactNode;
  // An icon before the title; decorative.
  icon?: IconComponent | undefined;
}

const crumbLink = 'rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

// Shared by all five page patterns: breadcrumb, the page's only h1, then its actions at the end.
export function PageHeader({ breadcrumbs, title, actions, description, icon: Icon }: PageHeaderProps) {
  const RouterLink = useRouterLink();
  return (
    <div data-slot="page-header" className="flex flex-col gap-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.label}>
                {index > 0 && (
                  <li aria-hidden="true" className="text-muted-foreground">
                    <ChevronRight className="size-3.5" />
                  </li>
                )}
                <li>
                  {crumb.href ? (
                    RouterLink ? (
                      <RouterLink href={crumb.href} className={crumbLink}>
                        {crumb.label}
                      </RouterLink>
                    ) : (
                      <a href={crumb.href} className={crumbLink}>
                        {crumb.label}
                      </a>
                    )
                  ) : (
                    <span className="text-muted-foreground">{crumb.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-semibold tracking-tight text-balance">
          {Icon && <Icon size={22} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
          {title}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

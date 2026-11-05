import type { Permission } from '@tenantry/auth';
import { appLinks, canSeeAdmin, RouterLink, useBranding, useMe, useWorkspaces } from '@tenantry/app-kit';
import { AppShell, type NavItem } from '@tenantry/ui';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { ApplicationsRoute } from './features/applications/ApplicationsRoute.js';
import { AppDetailRoute } from './features/applications/AppDetailRoute.js';
import { RegisterAppRoute } from './features/applications/RegisterAppRoute.js';
import { TestCallbackRoute } from './features/applications/TestCallbackRoute.js';
import { AuditRoute } from './features/audit/AuditRoute.js';
import { BrandingRoute } from './features/branding/BrandingRoute.js';
import { NotAllowedPage } from './features/not-allowed/NotAllowedPage.js';
import { PeopleRoute } from './features/people/PeopleRoute.js';
import { ScimRoute } from './features/scim/ScimRoute.js';
import { SecurityRoute } from './features/security/SecurityRoute.js';

type Person = ReturnType<typeof useMe>;
type Page = NavItem & { shown: (me: Person) => boolean };

const can = (permission: Permission) => (me: Person) => me.can(permission);
const enterpriseApps = (me: Person) => me.tenant.tier === 'enterprise' && me.can('apps:register');

// Admin's menu, in order (ADR-0027). The API checks every call again; this only decides what is shown.
const PAGES: Page[] = [
  { label: 'People', href: '/people', shown: can('members:invite') },
  { label: 'Branding', href: '/branding', shown: can('tenant:settings') },
  { label: 'Sign-in & security', href: '/security', shown: can('tenant:settings') },
  { label: 'Audit log', href: '/audit', shown: can('audit:read') },
];
const ADVANCED: Page[] = [
  { label: 'Directory sync (SCIM)', href: '/advanced/scim', shown: can('tenant:settings') },
  { label: 'Customer apps', href: '/advanced/apps', shown: enterpriseApps },
];

function menuFor(me: Person): NavItem[] {
  const visible = (pages: Page[]): NavItem[] =>
    pages.filter((p) => p.shown(me)).map(({ label, href }) => ({ label, href }));
  const advanced = visible(ADVANCED);
  if (me.consoleUrl) advanced.push({ label: 'Keycloak console', href: me.consoleUrl, external: true });
  const menu = visible(PAGES);
  if (advanced.length) menu.push({ label: 'Advanced', href: '#advanced', children: advanced });
  return menu;
}

// An app address from before Phase 6a: /applications/<id> lives at /advanced/apps/<id> now.
function OldAppAddress() {
  const { id } = useParams();
  return <Navigate replace to={`/advanced/apps/${id ?? ''}`} />;
}

// The workspace's Admin, once signed in: people, settings and the advanced tools. Root supplies the theme.
export function App({ onSignOut }: { onSignOut?: () => void }) {
  const { pathname } = useLocation();
  const me = useMe();
  const workspaces = useWorkspaces();
  const { branding, reload } = useBranding(me.tenant.slug);
  const admin = canSeeAdmin(me.can);
  const nav = admin ? menuFor(me) : [];
  const first = nav[0]?.children?.[0]?.href ?? nav[0]?.href;
  const settings = me.can('tenant:settings');
  const apps = enterpriseApps(me);
  return (
    <AppShell
      productName={me.tenant.name}
      logoUrl={branding?.logoUrl ?? null}
      apps={appLinks(workspaces, 'portal', { admin })}
      workspaces={workspaces.map(({ slug, name, current, portalUrl }) => ({
        slug,
        name,
        current,
        href: portalUrl,
      }))}
      navItems={nav}
      currentPath={pathname}
      linkAs={RouterLink}
      {...(onSignOut && me.user.email ? { user: { email: me.user.email, onSignOut } } : {})}
    >
      {!admin ? (
        <NotAllowedPage />
      ) : (
        <Routes>
          <Route path="/" element={first ? <Navigate replace to={first} /> : <NotAllowedPage />} />
          {me.can('members:invite') && <Route path="/people" element={<PeopleRoute />} />}
          {me.can('audit:read') && <Route path="/audit" element={<AuditRoute />} />}
          {settings && (
            <>
              <Route path="/branding" element={<BrandingRoute onChanged={reload} />} />
              <Route path="/security" element={<SecurityRoute />} />
              <Route path="/advanced/scim" element={<ScimRoute />} />
              <Route path="/scim" element={<Navigate replace to="/advanced/scim" />} />
            </>
          )}
          {apps && (
            <>
              <Route path="/advanced/apps" element={<ApplicationsRoute />} />
              <Route path="/advanced/apps/new" element={<RegisterAppRoute />} />
              <Route path="/advanced/apps/:id" element={<AppDetailRoute />} />
              {/* Registered redirect URIs name this path, so it stays where it was. */}
              <Route path="/applications/test-callback" element={<TestCallbackRoute />} />
              <Route path="/applications" element={<Navigate replace to="/advanced/apps" />} />
              <Route path="/applications/:id" element={<OldAppAddress />} />
            </>
          )}
          <Route path="*" element={<NotAllowedPage />} />
        </Routes>
      )}
    </AppShell>
  );
}

import { Badge, Button, TechLogo, TenantryMark, type TechName } from '@tenantry/ui';
import { Database, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react';
import { DemoSignIns } from './DemoSignIns.js';
import { GoToWorkspace, workspaceUrl } from './GoToWorkspace.js';

const REPO = 'https://github.com/mfurqanwork/tenantry-keycloak-multitenancy';
const DOCS = `${REPO}/tree/main/docs`;

const STACK: TechName[] = ['keycloak', 'postgresql', 'docker', 'openid', 'scim'];
const STACK_LABELS: Record<string, string> = {
  keycloak: 'Keycloak',
  postgresql: 'PostgreSQL',
  docker: 'Docker',
  openid: 'OpenID Connect',
  scim: 'SCIM',
};

const TIERS = [
  {
    name: 'Standard',
    opal: false,
    lines: ['An organization in the shared realm', 'Ready the moment you sign up', 'One sign-in across workspaces'],
  },
  {
    name: 'Enterprise',
    opal: true,
    lines: ['A Keycloak realm of its own', 'Company login and directory sync', 'Moves from Standard, accounts kept'],
  },
];

const LAYERS: { name: string; icon: LucideIcon; line: string }[] = [
  { name: 'Token', icon: KeyRound, line: "Roles come only from the workspace's own claim." },
  { name: 'API', icon: ShieldCheck, line: 'Every request is checked against the host it came to.' },
  { name: 'Database', icon: Database, line: 'Row-level security on every tenant table.' },
];

const section = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

// The base domain's front page (spec §4): what Tenantry is, and the ways in. No sign-in until one is chosen.
export function WelcomeRoute({
  baseDomain,
  demoWorkspaces,
  demoPassword,
}: {
  baseDomain: string;
  demoWorkspaces: string[];
  demoPassword?: string | undefined;
}) {
  const hasDemo = demoWorkspaces.length > 0;
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className={`${section} flex h-14 items-center gap-2`}>
          <a href="/" className="mr-auto flex items-center gap-2 rounded-md font-semibold">
            <TenantryMark />
            <span>Tenantry</span>
          </a>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href={DOCS}>Docs</a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href={REPO}>
              <TechLogo name="github" withLabel />
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <a href="#go">Go to your workspace</a>
          </Button>
          <Button asChild size="sm">
            <a href="/signup">Create a workspace</a>
          </Button>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <section className={`${section} grid items-center gap-10 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-24`}>
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
              Sign-in for every customer,
              <br />
              handled by <span className="opal-text">Tenantry</span>.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Sign-in, teams and branding for every customer workspace, built on Keycloak.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/signup">Create a workspace</a>
              </Button>
              {hasDemo && (
                <Button asChild variant="secondary">
                  <a href="#demo">Try the demo</a>
                </Button>
              )}
            </div>
          </div>
          <picture className="block overflow-hidden rounded-xl border border-border shadow-raised">
            <source srcSet="/welcome/home-dark.png" media="(prefers-color-scheme: dark)" />
            <img
              src="/welcome/home-light.png"
              alt="Tenantry Home: the setup checklist, workspace numbers and latest projects"
              className="block h-auto w-full"
              width={1280}
              height={800}
            />
          </picture>
        </section>

        <section aria-label="Built on" className="border-y border-border bg-muted/50">
          <ul className={`${section} flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-6 text-muted-foreground`}>
            {STACK.map((name) => (
              <li key={name} className="flex items-center gap-2 text-sm font-medium">
                {name === 'scim' ? (
                  <TechLogo name={name} />
                ) : (
                  <>
                    <TechLogo name={name} size={20} />
                    <span aria-hidden="true">{STACK_LABELS[name]}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${section} grid gap-4 py-16 md:grid-cols-2`} aria-label="Two tiers">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`flex flex-col gap-4 rounded-xl border bg-card p-6 ${tier.opal ? 'border-transparent opal-frame' : 'border-border'}`}
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {tier.name}
                {tier.opal && <Badge tone="opal">Own realm</Badge>}
              </h2>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {tier.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className={`${section} flex flex-col gap-8 pb-16`} aria-labelledby="isolation">
          <h2 id="isolation" className="text-2xl font-semibold tracking-tight">
            Isolated three times over
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {LAYERS.map(({ name, icon: Icon, line }) => (
              <div key={name} className="flex flex-col gap-2">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="font-semibold">{name}</h3>
                <p className="text-sm text-muted-foreground">{line}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="go" className="border-t border-border bg-muted/50 scroll-mt-14">
          <div className={`${section} grid gap-8 py-16 md:grid-cols-2`}>
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Go to your workspace</h2>
              <GoToWorkspace baseDomain={baseDomain} />
            </div>
            {hasDemo && (
              <div id="demo" className="flex scroll-mt-14 flex-col gap-4">
                <h2 className="text-xl font-semibold">Try a demo workspace</h2>
                <ul className="flex flex-wrap gap-2">
                  {demoWorkspaces.map((slug) => (
                    <li key={slug}>
                      <Button asChild variant="outline" size="sm">
                        <a href={workspaceUrl(slug, baseDomain)}>{slug}</a>
                      </Button>
                    </li>
                  ))}
                </ul>
                {demoPassword && <DemoSignIns baseDomain={baseDomain} password={demoPassword} />}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${section} flex flex-wrap items-center gap-x-6 gap-y-2 py-6 text-sm text-muted-foreground`}>
          <span className="flex items-center gap-2">
            <TenantryMark className="size-5" />
            Tenantry, a Pengopal product
          </span>
          <a href={DOCS} className="hover:text-foreground">
            Docs
          </a>
          <a href={REPO} className="hover:text-foreground">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

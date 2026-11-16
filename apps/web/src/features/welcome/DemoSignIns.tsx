import { workspaceUrl } from './GoToWorkspace.js';

const ACCOUNTS = [
  { email: 'ada@example.test', role: 'Owner', slug: 'pengopal', workspace: 'Pengopal' },
  { email: 'cy@example.test', role: 'Member', slug: 'pengopal', workspace: 'Pengopal' },
  { email: 'gil@example.test', role: 'Owner', slug: 'globex', workspace: 'Globex' },
];

// The live demo's public sign-ins (ADR-0029); shown only when a password is built in.
export function DemoSignIns({ baseDomain, password }: { baseDomain: string; password: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="font-semibold">Sign in to the demo</h3>
      <ul className="flex flex-col gap-1.5">
        {ACCOUNTS.map(({ email, role, slug, workspace }) => (
          <li key={email} className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono text-foreground">{email}</code>
            <span className="text-muted-foreground">{role}</span>
            <a
              className="text-link hover:underline"
              href={workspaceUrl(slug, baseDomain)}
            >{`Open ${workspace}`}</a>
          </li>
        ))}
      </ul>
      <p>
        Password: <code className="font-mono text-foreground">{password}</code>
      </p>
      <p className="text-muted-foreground">
        Anyone can use these accounts. The demo resets every night, and whatever you create is removed.
      </p>
    </div>
  );
}

import { Link, Stack } from '@carbon/react';
import { workspaceUrl } from './GoToWorkspace.js';

const ACCOUNTS = [
  { email: 'ada@example.test', role: 'Owner', slug: 'acme', workspace: 'Acme' },
  { email: 'cy@example.test', role: 'Member', slug: 'acme', workspace: 'Acme' },
  { email: 'gil@example.test', role: 'Owner', slug: 'globex', workspace: 'Globex' },
];

// The live demo's public sign-ins (ADR-0029); shown only when a password is built in.
export function DemoSignIns({ baseDomain, password }: { baseDomain: string; password: string }) {
  return (
    <Stack gap={5}>
      <h2 className="tenantry-welcome__heading">Sign in to the demo</h2>
      <ul className="tenantry-welcome__demos">
        {ACCOUNTS.map(({ email, role, slug, workspace }) => (
          <li key={email}>
            <code>{email}</code> {role}.{' '}
            <Link href={workspaceUrl(slug, baseDomain)}>{`Open ${workspace}`}</Link>
          </li>
        ))}
      </ul>
      <p>
        Password: <code>{password}</code>
      </p>
      <p>Anyone can use these accounts. The demo resets every night, and whatever you create is removed.</p>
    </Stack>
  );
}

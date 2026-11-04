import { DirectoryError } from '../errors.js';
import type { RealmProvisioner } from '../realms/provisioner.js';
import { diffTemplate, type TemplateDiff } from '../realms/template-diff.js';
import type { SecuritySettings, TwoStep } from '@tenantry/auth';
import { securityRealmPatch } from '../realms/security.js';
import {
  MAPPED_GROUPS,
  type ClientTemplate,
  type RealmTemplate,
  type SecondStep,
} from '../realms/templates.js';

interface FakeRealm {
  settings: Record<string, unknown>;
  profiles: unknown;
  policies: unknown;
  clients: Map<string, Record<string, unknown>>;
  backendSecret: string | null;
  admins: Map<string, string>;
  // First admins who have set a password.
  activated: Set<string>;
  twoStep: TwoStep | null;
  groups: Map<string, string>;
}

// A Keycloak stand-in for the provisioning saga's tests. Counts what each step really did.
export class InMemoryRealmProvisioner implements RealmProvisioner {
  readonly realms = new Map<string, FakeRealm>();
  readonly emailsSent: { realm: string; email: string }[] = [];
  private readonly failing = new Set<keyof RealmProvisioner>();

  failOn(step: keyof RealmProvisioner): void {
    this.failing.add(step);
  }

  clearFailures(): void {
    this.failing.clear();
  }

  private run<T>(step: keyof RealmProvisioner, fn: () => T): Promise<T> {
    return Promise.resolve().then(() => {
      if (this.failing.has(step)) throw new DirectoryError(step, 500, 'injected failure');
      return fn();
    });
  }

  private realm(step: keyof RealmProvisioner, name: string): FakeRealm {
    const found = this.realms.get(name);
    if (!found) throw new DirectoryError(step, 404, `realm ${name}`);
    return found;
  }

  ensureRealm(realm: string) {
    return this.run('ensureRealm', () => {
      if (this.realms.has(realm)) return { created: false };
      this.realms.set(realm, {
        settings: {},
        profiles: null,
        policies: null,
        clients: new Map(),
        backendSecret: null,
        admins: new Map(),
        activated: new Set(),
        twoStep: null,
        groups: new Map(),
      });
      return { created: true };
    });
  }

  applyTemplate(realm: string, template: RealmTemplate) {
    return this.run('applyTemplate', () => {
      const r = this.realm('applyTemplate', realm);
      r.settings = { ...r.settings, ...template.realm };
      r.profiles = template.clientProfiles;
      r.policies = template.clientPolicies;
      r.twoStep = template.twoStep;
    });
  }

  applySecurity(realm: string, settings: SecuritySettings, _secondStep: SecondStep) {
    return this.run('applySecurity', () => {
      const r = this.realm('applySecurity', realm);
      r.settings = { ...r.settings, ...securityRealmPatch(settings) };
      r.twoStep = settings.twoStep;
    });
  }

  ensureGroups(realm: string) {
    return this.run('ensureGroups', () => {
      const r = this.realm('ensureGroups', realm);
      for (const [name, role] of Object.entries(MAPPED_GROUPS)) r.groups.set(name, role);
    });
  }

  // Tests: someone changed the second step in the Keycloak console.
  setTwoStepByHand(realm: string, twoStep: TwoStep): void {
    const r = this.realms.get(realm);
    if (r) r.twoStep = twoStep;
  }

  ensureClients(realm: string, clients: ClientTemplate[]) {
    return this.run('ensureClients', () => {
      const r = this.realm('ensureClients', realm);
      for (const c of clients) r.clients.set(String(c.representation['clientId']), { ...c.representation });
    });
  }

  setBackendSecret(realm: string, secret: string) {
    return this.run('setBackendSecret', () => {
      this.realm('setBackendSecret', realm).backendSecret = secret;
    });
  }

  ensureFirstAdmin(realm: string, email: string) {
    return this.run('ensureFirstAdmin', () => {
      const r = this.realm('ensureFirstAdmin', realm);
      const existing = r.admins.get(email);
      const kcUserId = existing ?? `${realm}-user-${String(r.admins.size + 1)}`;
      r.admins.set(email, kcUserId);
      // Like Keycloak: the email goes out on every run until the owner has a password.
      if (!r.activated.has(email)) this.emailsSent.push({ realm, email });
      return { created: !existing, kcUserId };
    });
  }

  smokeTest(realm: string, backendSecret: string) {
    return this.run('smokeTest', () => {
      if (this.realm('smokeTest', realm).backendSecret !== backendSecret) {
        throw new DirectoryError('smokeTest', 401, 'backend token refused');
      }
    });
  }

  diff(realm: string, template: RealmTemplate, clients: ClientTemplate[]): Promise<TemplateDiff[]> {
    return this.run('diff', () => {
      const r = this.realm('diff', realm);
      const live = Object.fromEntries(r.clients);
      const wanted = Object.fromEntries(
        clients.map((c) => [String(c.representation['clientId']), c.representation]),
      );
      return [
        ...diffTemplate({ realm: template.realm }, { realm: r.settings }),
        ...diffTemplate({ clients: wanted }, { clients: live }),
        ...(r.twoStep !== null && r.twoStep !== template.twoStep
          ? [
              {
                path: `secondStep.${template.secondStep.subflow}`,
                live: r.twoStep,
                template: template.twoStep,
              },
            ]
          : []),
      ];
    });
  }
}

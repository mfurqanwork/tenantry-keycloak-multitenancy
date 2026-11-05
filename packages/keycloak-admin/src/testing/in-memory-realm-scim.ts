import { randomUUID } from 'node:crypto';
import { DirectoryError } from '../errors.js';
import type { RealmScim, ScimRequest, ScimResponse } from '../realms/scim.js';
import { MAPPED_GROUPS } from '../realms/templates.js';

interface FakePerson {
  userName: string;
  active: boolean;
  role: 'member' | 'owner' | null;
}

const ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';
const reply = (status: number, body?: unknown, headers: Record<string, string> = {}): ScimResponse => ({
  status,
  headers: body === undefined ? headers : { 'content-type': 'application/scim+json', ...headers },
  body: Buffer.from(body === undefined ? '' : JSON.stringify(body)),
});

// A realm's native SCIM for the gateway's tests; the SCIM contract keeps it honest against Keycloak.
export class InMemoryRealmScim implements RealmScim {
  enabled = false;
  readonly people = new Map<string, FakePerson>();
  readonly groups = new Map<string, { name: string; members: Set<string> }>();
  readonly calls: ScimRequest[] = [];
  private failure: number | null = null;

  constructor(readonly issuer = 'http://auth.test/realms/ent-fake') {
    for (const name of Object.keys(MAPPED_GROUPS))
      this.groups.set(randomUUID(), { name, members: new Set() });
  }

  // The next forward fails as if Keycloak could not be reached (0) or answered with this status.
  failNext(status: number): void {
    this.failure = status;
  }

  groupNamed(name: string): string {
    return [...this.groups].find(([, g]) => g.name === name)?.[0] ?? '';
  }

  prepared = false;

  prepare(): Promise<void> {
    this.prepared = true;
    return Promise.resolve();
  }

  enable(): Promise<void> {
    this.enabled = true;
    return Promise.resolve();
  }

  disable(): Promise<void> {
    this.enabled = false;
    return Promise.resolve();
  }

  forward(req: ScimRequest): Promise<ScimResponse> {
    this.calls.push(req);
    return Promise.resolve().then(() => {
      const failure = this.failure;
      this.failure = null;
      if (failure === 0) throw new DirectoryError('scimForward', 0, 'unreachable');
      if (failure) return reply(failure, { schemas: [ERROR], status: String(failure), detail: 'injected' });
      if (!this.enabled) return reply(401, { schemas: [ERROR], status: '401', detail: 'SCIM is off' });
      return this.handle(req);
    });
  }

  private handle(req: ScimRequest): ScimResponse {
    const [kind, id] = req.path.split('/');
    const body = req.body?.length ? (JSON.parse(req.body.toString('utf8')) as Record<string, unknown>) : {};
    if (kind === 'Users' && ((!id && req.method === 'GET') || (id === '.search' && req.method === 'POST'))) {
      const all = [...this.people].map(([pid, p]) => ({ id: pid, userName: p.userName, active: p.active }));
      return reply(200, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: all.length,
        Resources: all,
      });
    }
    if (kind === 'Users' && !id && req.method === 'POST') {
      const pid = randomUUID();
      this.people.set(pid, {
        userName: String(body['userName']),
        active: body['active'] !== false,
        role: null,
      });
      return reply(
        201,
        { id: pid, userName: body['userName'], active: body['active'] !== false },
        { location: `${this.issuer}/scim/v2/Users/${pid}` },
      );
    }
    if (kind === 'Users' && id) {
      const person = this.people.get(id);
      if (!person) return reply(404, { schemas: [ERROR], status: '404', detail: 'not found' });
      if (req.method === 'DELETE') {
        this.people.delete(id);
        return reply(204);
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const ops = (body['Operations'] as { path?: string; value?: unknown }[] | undefined) ?? [];
        for (const op of ops) {
          const v =
            op.path?.toLowerCase() === 'active'
              ? op.value
              : (op.value as { active?: unknown } | undefined)?.active;
          if (v !== undefined)
            person.active = !(v === false || (typeof v === 'string' && v.toLowerCase() === 'false'));
        }
        if (req.method === 'PUT' && body['active'] !== undefined) person.active = body['active'] !== false;
      }
      return reply(200, { id, userName: person.userName, active: person.active });
    }
    if (kind === 'Groups' && !id) {
      const all = [...this.groups].map(([gid, g]) => ({ id: gid, displayName: g.name }));
      return reply(200, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: all.length,
        Resources: all,
      });
    }
    if (kind === 'Groups' && id) {
      const group = this.groups.get(id);
      if (!group) return reply(404, { schemas: [ERROR], status: '404', detail: 'not found' });
      if (req.method === 'DELETE') {
        this.groups.delete(id);
        return reply(204);
      }
      return reply(200, {
        id,
        displayName: group.name,
        members: [...group.members].map((value) => ({ value })),
      });
    }
    return reply(404, { schemas: [ERROR], status: '404', detail: 'not found' });
  }

  grantRole(kcUserId: string, role: 'member'): Promise<void> {
    const person = this.people.get(kcUserId);
    if (!person) return Promise.reject(new DirectoryError('grantRole', 404, kcUserId));
    person.role = role;
    return Promise.resolve();
  }

  isOwner(kcUserId: string): Promise<boolean> {
    return Promise.resolve(this.people.get(kcUserId)?.role === 'owner');
  }

  isMappedGroup(groupId: string): Promise<boolean> {
    const name = this.groups.get(groupId)?.name;
    return Promise.resolve(name !== undefined && Object.keys(MAPPED_GROUPS).includes(name));
  }

  emptyGroup(groupId: string): Promise<void> {
    this.groups.get(groupId)?.members.clear();
    return Promise.resolve();
  }
}

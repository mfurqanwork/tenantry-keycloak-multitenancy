import { groupForRole, roleForGroupPath, type Role } from '@tenantry/auth';
import type { IdentityDirectory } from './identity-directory.js';

export interface Member {
  kcUserId: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
}

// One tenant's members, whatever its tier. Standard: the organization's groups in the platform realm.
// Enterprise: the realm's users holding a tenantry-api client role (ADR-0004).
export interface MemberDirectory {
  listMembers(): Promise<Member[]>;
  // Standard sends Keycloak's organization invite (the role is applied when it is claimed, ADR-0019) and
  // returns no user id. Enterprise creates the user, or finds an existing one, with the role at once.
  invite(email: string, role: Role): Promise<{ kcUserId: string | null }>;
  setRole(kcUserId: string, role: Role): Promise<void>;
  remove(kcUserId: string): Promise<void>;
  // Deletes a user an invite created who never set a password; false for anyone else.
  deleteUnusedUser(kcUserId: string): Promise<boolean>;
}

export function organizationMembers(directory: IdentityDirectory, orgId: string): MemberDirectory {
  return {
    async listMembers() {
      return (await directory.listMembers(orgId)).map((m) => ({
        kcUserId: m.kcUserId,
        email: m.email,
        displayName: m.displayName,
        role: m.group ? roleForGroupPath(m.group) : null,
      }));
    },
    async invite(email) {
      await directory.inviteUser(orgId, email);
      return { kcUserId: null };
    },
    setRole: (kcUserId, role) => directory.setMemberGroup(orgId, kcUserId, groupForRole(role)),
    remove: (kcUserId) => directory.removeMember(orgId, kcUserId),
    deleteUnusedUser: () => Promise.resolve(false),
  };
}

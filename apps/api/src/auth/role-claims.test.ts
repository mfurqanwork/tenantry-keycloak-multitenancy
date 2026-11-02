import { describe, expect, it } from 'vitest';
import { rolesFromClaims } from './role-claims.js';

describe('rolesFromClaims', () => {
  it("reads roles from this tenant's organization block", () => {
    expect(rolesFromClaims({ organization: { acme: { groups: ['/admins'] } } }, 'acme')).toEqual({
      member: true,
      roles: ['admin'],
    });
  });

  it("ignores another tenant's block", () => {
    expect(rolesFromClaims({ organization: { other: { groups: ['/owners'] } } }, 'acme')).toEqual({
      member: false,
    });
  });

  it('treats an empty group list as a member with no role yet', () => {
    expect(rolesFromClaims({ organization: { acme: { groups: [] } } }, 'acme')).toEqual({
      member: true,
      roles: [],
    });
  });

  it('is not a member without an organization claim', () => {
    expect(rolesFromClaims({}, 'acme')).toEqual({ member: false });
  });

  it('never reads the top-level realm_access claim', () => {
    expect(rolesFromClaims({ realm_access: { roles: ['owner', 'admin'] } }, 'acme')).toEqual({
      member: false,
    });
  });

  it('keeps every known group and drops unknown ones', () => {
    expect(
      rolesFromClaims(
        { organization: { acme: { groups: ['/owners', '/members', '/weird', '/admins/x'] } } },
        'acme',
      ),
    ).toEqual({ member: true, roles: ['owner', 'member'] });
  });

  it('survives malformed claims', () => {
    expect(rolesFromClaims({ organization: 'acme' }, 'acme')).toEqual({ member: false });
    expect(rolesFromClaims({ organization: { acme: { groups: 'owners' } } }, 'acme')).toEqual({
      member: true,
      roles: [],
    });
    expect(rolesFromClaims({ organization: ['acme'] }, 'acme')).toEqual({ member: false });
  });
});

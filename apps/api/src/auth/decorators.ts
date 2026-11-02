import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission, TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import type { AuthedRequest, SignedInUser } from './request-context.js';

export const PUBLIC = 'tenantry:public';
export const SIGNED_IN_ONLY = 'tenantry:signed-in-only';
export const PERMISSION = 'tenantry:permission';

// No token needed.
export const Public = () => SetMetadata(PUBLIC, true);
// A valid platform token on the apex host; no tenant (signup).
export const SignedInOnly = () => SetMetadata(SIGNED_IN_ONLY, true);
// AGENTS.md rule 7: routes name a permission, never a role.
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION, permission);

function fromRequest<K extends 'tenantContext' | 'tenant' | 'signedIn'>(key: K) {
  return (_: unknown, ctx: ExecutionContext): NonNullable<AuthedRequest[K]> => {
    const value = ctx.switchToHttp().getRequest<AuthedRequest>()[key];
    // A route reading what its guard path never sets is a programming error, not a client error.
    if (value === undefined) throw new Error(`${key} is not available on this route`);
    return value;
  };
}

export const Ctx = createParamDecorator<unknown, TenantContext>(fromRequest('tenantContext'));
export const CurrentTenant = createParamDecorator<unknown, TenantRecord>(fromRequest('tenant'));
export const SignedIn = createParamDecorator<unknown, SignedInUser>(fromRequest('signedIn'));

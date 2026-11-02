import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import type { Request } from 'express';

export interface SignedInUser {
  userId: string;
  kcUserId: string;
  email: string | null;
  displayName: string | null;
  issuer: string;
}

// What the guard attaches. Only the guard writes these fields.
export interface AuthedRequest extends Request {
  tenant?: TenantRecord;
  tenantContext?: TenantContext;
  signedIn?: SignedInUser;
}

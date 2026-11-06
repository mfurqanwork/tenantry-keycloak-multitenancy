import type { TenantContext } from '@tenantry/auth';
import type { TenantRecord } from '@tenantry/db';
import type { Request } from 'express';

export interface SignedInUser {
  userId: string;
  kcUserId: string;
  email: string | null;
  displayName: string | null;
  issuer: string;
  // The token's email_verified claim; only a verified email reads invites across workspaces (ADR-0028).
  emailVerified?: boolean;
}

// What the guard attaches. Only the guard writes these fields.
export interface AuthedRequest extends Request {
  tenant?: TenantRecord;
  tenantContext?: TenantContext;
  signedIn?: SignedInUser;
  // Set on @OperatorOnly() routes: which operator client called.
  operator?: { clientId: string };
}

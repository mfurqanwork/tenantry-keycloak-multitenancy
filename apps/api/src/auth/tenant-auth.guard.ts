import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { highestRole, permissionsFor, type Permission } from '@tenantry/auth';
import { platformRepository, type Db } from '@tenantry/db';
import type { JWTPayload } from 'jose';
import { ForbiddenProblem, NotFoundProblem, UnauthorizedProblem } from '../common/http-errors.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DB } from '../infrastructure/tokens.js';
import { PERMISSION, PUBLIC, SIGNED_IN_ONLY } from './decorators.js';
import { slugFromHost } from './host.js';
import { InviteClaimer } from './invite-claimer.js';
import type { AuthedRequest, SignedInUser } from './request-context.js';
import { rolesFromClaims } from './role-claims.js';
import { createTokenVerifier, type TokenVerifier } from './token-verifier.js';

const AUDIENCE = 'tenantry-api';

// The single place a request becomes a TenantContext (spec: "Auth guard", eight steps).
// The tenant comes from the Host header and the token only; no header, query or body can set it.
@Injectable()
export class TenantAuthGuard implements CanActivate {
  private readonly verifiers = new Map<string, TokenVerifier>();
  private readonly platformIssuer: string;

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly db: Db,
    private readonly invites: InviteClaimer,
  ) {
    this.platformIssuer = `${config.authUrl}/realms/${config.platformRealm}`;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const slug = slugFromHost(req.headers.host, this.config.baseDomain);

    if (this.reflector.getAllAndOverride<boolean>(SIGNED_IN_ONLY, targets)) {
      if (slug !== null) throw new NotFoundProblem();
      req.signedIn = await this.signIn(req, this.config.platformRealm, this.platformIssuer);
      return true;
    }

    // 1–2. The subdomain picks the tenant; it must exist and be active.
    if (slug === null) throw new NotFoundProblem();
    const platform = platformRepository(this.db);
    const tenant = await platform.findTenantBySlug(slug);
    if (!tenant || tenant.status !== 'active' || !tenant.issuer || !tenant.realm) {
      throw new NotFoundProblem('No workspace at this address.');
    }

    // 3–5. Signature, exact issuer and audience; 7. our user id for (iss, sub).
    const { payload, user } = await this.verifyAndIdentify(req, tenant.realm, tenant.issuer);

    // 6. Roles only from this tenant's organization block.
    const membership = rolesFromClaims(payload, tenant.slug);
    if (!membership.member) throw new ForbiddenProblem('You are not a member of this workspace.');
    let role = highestRole(membership.roles);
    role ??= await this.invites.claim({
      tenant,
      userId: user.userId,
      kcUserId: user.kcUserId,
      email: user.email,
      emailVerified: payload['email_verified'] === true,
    });
    if (!role) throw new ForbiddenProblem('You have no role in this workspace yet.');

    // 8. Attach the context, then check the route's permission.
    const permissions = permissionsFor([role]);
    req.tenant = tenant;
    req.signedIn = user;
    req.tenantContext = { tenantId: tenant.id, userId: user.userId, roles: [role], permissions };
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, targets);
    if (required && !permissions.has(required)) throw new ForbiddenProblem();
    return true;
  }

  private async signIn(req: AuthedRequest, realm: string, issuer: string): Promise<SignedInUser> {
    return (await this.verifyAndIdentify(req, realm, issuer)).user;
  }

  private async verifyAndIdentify(
    req: AuthedRequest,
    realm: string,
    issuer: string,
  ): Promise<{ payload: JWTPayload; user: SignedInUser }> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedProblem('Sign in to continue.');
    const payload = await this.verifierFor(realm, issuer)(token);
    if (!payload.sub) throw new UnauthorizedProblem();
    const email = typeof payload['email'] === 'string' ? payload['email'] : null;
    const displayName = typeof payload['name'] === 'string' ? payload['name'] : null;
    const { userId } = await platformRepository(this.db).upsertIdentity({
      issuer,
      subject: payload.sub,
      email,
      displayName,
    });
    return { payload, user: { userId, kcUserId: payload.sub, email, displayName, issuer } };
  }

  // Keys are fetched from the internal address; the issuer string is only compared, never resolved.
  private verifierFor(realm: string, issuer: string): TokenVerifier {
    let verifier = this.verifiers.get(issuer);
    if (!verifier) {
      verifier = createTokenVerifier({
        jwksUrl: new URL(`${this.config.authInternalUrl}/realms/${realm}/protocol/openid-connect/certs`),
        issuer,
        audience: AUDIENCE,
      });
      this.verifiers.set(issuer, verifier);
    }
    return verifier;
  }
}

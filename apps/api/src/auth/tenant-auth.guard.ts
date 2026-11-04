import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { highestRole, permissionsFor, type Permission } from '@tenantry/auth';
import { platformRepository, type Db } from '@tenantry/db';
import type { JWTPayload } from 'jose';
import { ForbiddenProblem, NotFoundProblem, UnauthorizedProblem } from '../common/http-errors.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DB } from '../infrastructure/tokens.js';
import { OPERATOR_ONLY, PERMISSION, PUBLIC, SIGNED_IN_ONLY } from './decorators.js';
import { slugFromHost } from './host.js';
import { InviteClaimer } from './invite-claimer.js';
import type { AuthedRequest, SignedInUser } from './request-context.js';
import { rolesFromClaims, rolesFromClientRoles } from './role-claims.js';
import { createTokenVerifier, type TokenVerifier } from './token-verifier.js';

const AUDIENCE = 'tenantry-api';
const OPERATOR_CLIENT = 'tenantry-ops';
const PRODUCT_APPS = new Set(['tenantry-web', 'tenantry-portal']);

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

    // The operator scripts: a client-credentials token from the platform realm, on the base domain only.
    if (this.reflector.getAllAndOverride<boolean>(OPERATOR_ONLY, targets)) {
      if (slug !== null) throw new NotFoundProblem();
      const payload = await this.verify(req, this.config.platformRealm, this.platformIssuer);
      if (payload['azp'] !== OPERATOR_CLIENT) throw new ForbiddenProblem('Operators only.');
      req.operator = { clientId: OPERATOR_CLIENT };
      return true;
    }

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

    // 3–5. Signature, exact issuer (this tenant's realm) and audience.
    const payload = await this.verify(req, tenant.realm, tenant.issuer);
    // An enterprise realm also holds the customer's own apps (ADR-0011): only our two apps' tokens count.
    if (tenant.tier === 'enterprise' && !PRODUCT_APPS.has(String(payload['azp']))) {
      throw new UnauthorizedProblem();
    }

    // 6. Roles. Standard: only this tenant's organization block. Enterprise: only tenantry-api's client
    // roles in the tenant's own realm (AGENTS.md rule 2).
    const membership =
      tenant.tier === 'enterprise' ? rolesFromClientRoles(payload) : rolesFromClaims(payload, tenant.slug);
    if (!membership.member) throw new ForbiddenProblem('You are not a member of this workspace.');

    // 7. Our user id for (iss, sub), created only for members; email and name follow the token.
    const user = await this.identify(payload, tenant.issuer);
    let role = highestRole(membership.roles);
    if (tenant.tier === 'enterprise' && role) {
      await this.invites.acceptOnSignIn({
        tenant,
        userId: user.userId,
        email: user.email,
        emailVerified: payload['email_verified'] === true,
      });
    }
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
    return this.identify(await this.verify(req, realm, issuer), issuer);
  }

  private async verify(req: AuthedRequest, realm: string, issuer: string): Promise<JWTPayload> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedProblem('Sign in to continue.');
    const payload = await this.verifierFor(realm, issuer)(token);
    if (!payload.sub) throw new UnauthorizedProblem();
    return payload;
  }

  private async identify(payload: JWTPayload, issuer: string): Promise<SignedInUser> {
    const subject = payload.sub ?? '';
    const email = typeof payload['email'] === 'string' ? payload['email'] : null;
    const displayName = typeof payload['name'] === 'string' ? payload['name'] : null;
    const { userId } = await platformRepository(this.db).upsertIdentity({
      issuer,
      subject,
      email,
      displayName,
    });
    return { userId, kcUserId: subject, email, displayName, issuer };
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

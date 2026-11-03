import { Inject, Injectable, Logger } from '@nestjs/common';
import { SlugTakenError, platformRepository, tenantTx, type Db } from '@tenantry/db';
import type { IdentityDirectory } from '@tenantry/keycloak-admin';
import { BadGatewayProblem, ConflictProblem } from '../../common/http-errors.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { DB, IDENTITY_DIRECTORY } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { runSaga, SagaFailedError } from './signup.saga.js';
import { tenantOrigin } from '../../common/tenant-origin.js';
import { validateSlug } from './slug.js';

export type Availability =
  { available: true } | { available: false; reason: 'format' | 'reserved' | 'taken' };

// Self-serve signup (ADR-0018): our tenant row, then Keycloak, then activation; undone on failure.
@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IDENTITY_DIRECTORY) private readonly directory: IdentityDirectory,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async availability(slug: string): Promise<Availability> {
    const check = validateSlug(slug);
    if (!check.ok) return { available: false, reason: check.reason };
    const existing = await platformRepository(this.db).findTenantBySlug(slug);
    return existing && existing.status !== 'failed'
      ? { available: false, reason: 'taken' }
      : { available: true };
  }

  async signup(
    user: SignedInUser,
    input: { name: string; slug: string },
  ): Promise<{ slug: string; url: string }> {
    const platform = platformRepository(this.db);
    let tenantId: string;
    try {
      tenantId = (await platform.insertProvisioningTenant(input)).id;
    } catch (err) {
      if (err instanceof SlugTakenError) throw new ConflictProblem('That address is taken.');
      throw err;
    }

    const origin = tenantOrigin(input.slug, this.config);
    const portalOrigin = tenantOrigin(input.slug, this.config, 'portal');
    const issuer = `${this.config.authUrl}/realms/${this.config.platformRealm}`;
    let orgId = '';
    try {
      await runSaga(
        [
          {
            name: 'create organization',
            run: async () => {
              // We hold this slug now, so an organization already using it is debris from an earlier
              // attempt whose Keycloak reply was lost; remove it rather than fail on the alias.
              const orphan = await this.directory.findOrganizationByAlias(input.slug);
              if (orphan) await this.directory.deleteOrganization(orphan.id);
              // Keycloak keeps organization names unique; display names are not, so the slug is the name.
              orgId = (await this.directory.createOrganization({ alias: input.slug, name: input.slug })).id;
            },
            undo: () => this.directory.deleteOrganization(orgId),
          },
          { name: 'create groups', run: () => this.directory.createGroups(orgId) },
          { name: 'add owner', run: () => this.directory.addMember(orgId, user.kcUserId) },
          { name: 'make owner', run: () => this.directory.setMemberGroup(orgId, user.kcUserId, 'owners') },
          {
            name: 'register web origin',
            run: () => this.directory.addTenantOrigin(origin, 'web'),
            undo: () => this.directory.removeTenantOrigin(origin, 'web'),
          },
          {
            name: 'register portal origin',
            run: () => this.directory.addTenantOrigin(portalOrigin, 'portal'),
            undo: () => this.directory.removeTenantOrigin(portalOrigin, 'portal'),
          },
          {
            name: 'activate',
            run: () =>
              tenantTx(this.db, tenantId, async (tx) => {
                await platformRepository(tx).activateTenant(tenantId, {
                  realm: this.config.platformRealm,
                  issuer,
                  kcOrgId: orgId,
                });
                await this.audit.record(tx, user, 'tenant.created', tenantId, {
                  slug: input.slug,
                  name: input.name,
                });
              }),
          },
        ],
        (step, err) => {
          this.logger.error({ err, step, slug: input.slug }, 'signup undo failed; clean up by hand');
        },
      );
    } catch (err) {
      await platform.markTenantFailed(tenantId);
      if (err instanceof SagaFailedError) {
        this.logger.warn({ err: err.cause, step: err.step, slug: input.slug }, 'signup failed');
        throw new BadGatewayProblem('We could not finish setting up your workspace. Try again in a moment.');
      }
      throw err;
    }
    return { slug: input.slug, url: origin };
  }
}

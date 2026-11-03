import { Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { darkerUntilContrast, meetsContrast } from '@tenantry/brand';
import {
  deleteLogo,
  getLogo,
  platformRepository,
  putLogo,
  tenantTx,
  type Db,
  type LogoRecord,
  type TenantBranding,
  type TenantRecord,
} from '@tenantry/db';
import { NotFoundProblem, ValidationProblem } from '../../common/http-errors.js';
import { DB } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { sniffImageType } from './logo-type.js';

export interface PublicBranding {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
}

// A tenant's colour lives on the tenant row, its logo in tenant_logos (row-level security).
@Injectable()
export class BrandingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  // Before sign-in: the login page and the apps' first paint. Only active workspaces have a brand.
  async publicBranding(slug: string): Promise<PublicBranding> {
    const tenant = await this.activeTenant(slug);
    const { primaryColor, logoVersion } = tenant.branding;
    return {
      name: tenant.name,
      primaryColor,
      logoUrl: logoVersion === null ? null : `/api/tenants/${tenant.slug}/logo?v=${String(logoVersion)}`,
    };
  }

  async logo(slug: string): Promise<{ logo: LogoRecord; version: number | null }> {
    const tenant = await this.activeTenant(slug);
    const logo = await tenantTx(this.db, tenant.id, (tx) => getLogo(tx));
    if (!logo) throw new NotFoundProblem('This workspace has no logo.');
    return { logo, version: tenant.branding.logoVersion };
  }

  // White text sits on the colour (primary buttons), so it must reach 4.5:1 against white.
  async setColor(
    ctx: TenantContext,
    tenant: TenantRecord,
    primaryColor: string | null,
  ): Promise<TenantBranding> {
    if (primaryColor !== null && !meetsContrast(primaryColor)) {
      throw new ValidationProblem('This colour is too light for white text (below 4.5:1 contrast).', {
        suggestion: darkerUntilContrast(primaryColor),
      });
    }
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      const platform = platformRepository(tx);
      // Read in the same transaction as the write, so the audit's "from" is the colour it replaced.
      const before = (await platform.findTenantById(tenant.id))?.branding.primaryColor ?? null;
      const branding = await platform.setBranding(tenant.id, { primaryColor });
      await this.audit.record(tx, ctx, 'branding.updated', tenant.id, { from: before, to: primaryColor });
      return branding;
    });
  }

  async setLogo(
    ctx: TenantContext,
    tenant: TenantRecord,
    bytes: Buffer | undefined,
  ): Promise<TenantBranding> {
    const contentType = bytes ? sniffImageType(bytes) : null;
    if (!bytes || !contentType) throw new ValidationProblem('Upload a PNG, JPEG or WebP image.');
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      await putLogo(tx, { contentType, bytes });
      // Each upload gets a new URL (the time, so a remove and re-upload never repeats one), and
      // browsers may cache each URL for good.
      const branding = await platformRepository(tx).setBranding(tenant.id, {
        logoVersion: Math.max(Date.now(), (tenant.branding.logoVersion ?? 0) + 1),
      });
      await this.audit.record(tx, ctx, 'branding.logo_updated', tenant.id, {
        contentType,
        bytes: bytes.length,
      });
      return branding;
    });
  }

  async removeLogo(ctx: TenantContext, tenant: TenantRecord): Promise<void> {
    await tenantTx(this.db, ctx.tenantId, async (tx) => {
      await deleteLogo(tx);
      await platformRepository(tx).setBranding(tenant.id, { logoVersion: null });
      await this.audit.record(tx, ctx, 'branding.logo_removed', tenant.id);
    });
  }

  private async activeTenant(slug: string): Promise<TenantRecord> {
    const tenant = await platformRepository(this.db).findTenantBySlug(slug.toLowerCase());
    if (tenant?.status !== 'active') throw new NotFoundProblem('No workspace at this address.');
    return tenant;
  }
}

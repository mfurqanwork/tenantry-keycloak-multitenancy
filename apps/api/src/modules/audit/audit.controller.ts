import { Controller, Get, Query } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { Ctx, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { auditQuery, type AuditQuery } from './audit.schemas.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit:read')
  list(@Ctx() ctx: TenantContext, @Query(new ZodPipe(auditQuery)) query: AuditQuery) {
    return this.audit.list(ctx.tenantId, query.before);
  }
}

import { Controller, Get } from '@nestjs/common';
import type { TenantRecord } from '@tenantry/db';
import { CurrentTenant, SignedIn } from '../../auth/decorators.js';
import type { SignedInUser } from '../../auth/request-context.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('me/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantRecord, @SignedIn() user: SignedInUser) {
    return this.workspaces.list(tenant, user);
  }
}

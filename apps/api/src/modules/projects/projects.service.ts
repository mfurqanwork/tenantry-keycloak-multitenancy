import { Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { createProject, getProject, listProjects, tenantTx, type Db, type ProjectRecord } from '@tenantry/db';
import { NotFoundProblem } from '../../common/http-errors.js';
import { DB } from '../../infrastructure/tokens.js';
import { AuditService } from '../audit/audit.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The row-level security example: no query here filters by tenant, and none needs to.
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  list(ctx: TenantContext): Promise<ProjectRecord[]> {
    return tenantTx(this.db, ctx.tenantId, (tx) => listProjects(tx));
  }

  // Another tenant's id is invisible under row-level security, so it is indistinguishable from a missing one.
  async get(ctx: TenantContext, id: string): Promise<ProjectRecord> {
    const project = UUID.test(id) ? await tenantTx(this.db, ctx.tenantId, (tx) => getProject(tx, id)) : null;
    if (!project) throw new NotFoundProblem('No such project.');
    return project;
  }

  create(ctx: TenantContext, name: string): Promise<ProjectRecord> {
    return tenantTx(this.db, ctx.tenantId, async (tx) => {
      const project = await createProject(tx, { name, ownerUserId: ctx.userId });
      await this.audit.record(tx, ctx, 'project.created', project.id, { name });
      return project;
    });
  }
}

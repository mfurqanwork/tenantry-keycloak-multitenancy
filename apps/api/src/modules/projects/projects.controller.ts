import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { TenantContext } from '@tenantry/auth';
import { Ctx, RequirePermission } from '../../auth/decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { createProjectBody, type CreateProjectBody } from './projects.schemas.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission('projects:read')
  async list(@Ctx() ctx: TenantContext) {
    return { projects: await this.projects.list(ctx) };
  }

  @Get(':id')
  @RequirePermission('projects:read')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string) {
    return this.projects.get(ctx, id);
  }

  @Post()
  @RequirePermission('projects:write')
  create(@Ctx() ctx: TenantContext, @Body(new ZodPipe(createProjectBody)) body: CreateProjectBody) {
    return this.projects.create(ctx, body.name);
  }
}

import { All, Controller, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/decorators.js';
import { ScimErrorFilter, ScimError } from './scim-errors.js';
import { parseScimPath, ScimGatewayService } from './scim-gateway.service.js';
import { ScimTokenGuard, type ScimRequest } from './scim-token.guard.js';

// https://<slug>.<base>/scim/v2/... for the customer's directory (ADR-0024). Public to
// TenantAuthGuard: a person's token never works here, only the workspace's SCIM token.
@Controller('scim/v2')
@Public()
@UseGuards(ScimTokenGuard)
@UseFilters(ScimErrorFilter)
export class ScimGatewayController {
  constructor(private readonly gateway: ScimGatewayService) {}

  @All('{*path}')
  async forward(@Req() req: ScimRequest, @Res() res: Response): Promise<void> {
    const tenant = req.scimTenant;
    if (!tenant) throw new ScimError(401, 'A valid SCIM token for this workspace is required.');
    const url = req.originalUrl;
    const at = url.indexOf('?');
    const segments = parseScimPath((at < 0 ? url : url.slice(0, at)).replace(/^\/scim\/v2\/?/i, ''));
    if (!segments) throw new ScimError(404, 'No such SCIM resource.');
    const body = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
    const contentType = req.headers['content-type'];
    const out = await this.gateway.handle(tenant, {
      method: req.method,
      segments,
      // As it came: a filter's quotes and plus signs stay encoded.
      query: at < 0 ? '' : url.slice(at + 1),
      ...(body ? { body } : {}),
      ...(contentType ? { contentType } : {}),
    });
    res.status(out.status);
    for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
    res.end(out.body);
  }
}

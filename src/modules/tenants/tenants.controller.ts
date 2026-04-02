import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { TenantsService } from './tenants.service';
import { CreateApiClientDto, CreateTenantDto } from './dtos/create-tenant.dto';

/**
 * Rotas administrativas — protegidas por X-Admin-Key.
 * Prefixo: /v1/admin/tenants
 *
 * Exemplos de uso:
 *   POST   /v1/admin/tenants
 *   GET    /v1/admin/tenants
 *   GET    /v1/admin/tenants/:id
 *   PATCH  /v1/admin/tenants/:id/toggle
 *   POST   /v1/admin/tenants/:id/api-clients
 *   GET    /v1/admin/tenants/:id/api-clients
 *   DELETE /v1/admin/tenants/:id/api-clients/:clientId
 */
@UseGuards(AdminGuard)
@Controller('admin/tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto) {
    return this.svc.create(dto);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/toggle')
  toggleStatus(@Param('id') id: string) {
    return this.svc.toggleStatus(id);
  }

  /**
   * POST /v1/admin/tenants/:id/api-clients
   *
   * Retorna api_key e api_secret (secret visível apenas nesta resposta).
   * Guarde o secret imediatamente — não é recuperável.
   */
  @Post(':id/api-clients')
  @HttpCode(HttpStatus.CREATED)
  createApiClient(
    @Param('id') tenantId: string,
    @Body() dto: CreateApiClientDto,
  ) {
    return this.svc.createApiClient(tenantId, dto);
  }

  @Get(':id/api-clients')
  listApiClients(@Param('id') tenantId: string) {
    return this.svc.listApiClients(tenantId);
  }

  @Delete(':id/api-clients/:clientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeApiClient(
    @Param('id') tenantId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.svc.revokeApiClient(tenantId, clientId);
  }
}

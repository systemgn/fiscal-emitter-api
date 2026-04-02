import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAdminGuard } from '../admin-auth/jwt-admin.guard';
import { CredentialsService } from './credentials.service';
import { UpsertCredentialDto } from './dtos/upsert-credential.dto';

@ApiTags('Admin — Credentials')
@ApiSecurity('admin-key')
@UseGuards(JwtAdminGuard)
@Controller('admin/tenants/:tenantId/credentials')
export class CredentialsController {
  constructor(private readonly svc: CredentialsService) {}

  /**
   * PUT /v1/admin/tenants/:tenantId/credentials
   * Cria ou atualiza credenciais (certificado PFX + OAuth) para o tenant.
   * Certificado deve ser enviado em Base64.
   */
  @Put()
  @ApiOperation({ summary: 'Upsert tenant credentials (PFX + OAuth)' })
  upsert(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertCredentialDto,
  ) {
    return this.svc.upsert(tenantId, dto);
  }

  /** GET /v1/admin/tenants/:tenantId/credentials — lista (sem expor bytes do cert) */
  @Get()
  @ApiOperation({ summary: 'List tenant credentials (masked)' })
  findAll(@Param('tenantId') tenantId: string) {
    return this.svc.findByTenant(tenantId);
  }

  /** GET /v1/admin/tenants/:tenantId/credentials/:environment */
  @Get(':environment')
  @ApiParam({ name: 'environment', enum: ['sandbox', 'production'] })
  findOne(
    @Param('tenantId') tenantId: string,
    @Param('environment') env: 'sandbox' | 'production',
  ) {
    return this.svc.findSafe(tenantId, env);
  }

  /** DELETE /v1/admin/tenants/:tenantId/credentials/:environment */
  @Delete(':environment')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'environment', enum: ['sandbox', 'production'] })
  remove(
    @Param('tenantId') tenantId: string,
    @Param('environment') env: 'sandbox' | 'production',
  ) {
    return this.svc.delete(tenantId, env);
  }
}

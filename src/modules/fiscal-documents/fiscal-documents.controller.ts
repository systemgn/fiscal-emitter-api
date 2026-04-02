import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { EmitDocumentDto } from './dtos/emit-document.dto';
import { CancelDocumentDto } from './dtos/cancel-document.dto';
import { ExportDocumentDto } from './dtos/export-document.dto';

@UseGuards(ApiKeyGuard)
@Controller('documents')
export class FiscalDocumentsController {
  constructor(private readonly svc: FiscalDocumentsService) {}

  /**
   * POST /v1/documents/emit
   * Solicita emissão de NFS-e. Idempotente por externalReference.
   */
  @Post('emit')
  @HttpCode(HttpStatus.ACCEPTED)
  emit(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: EmitDocumentDto,
  ) {
    return this.svc.emit(tenant, dto);
  }

  /**
   * GET /v1/documents/:id
   */
  @Get(':id')
  findById(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
  ) {
    return this.svc.findById(tenant.id, id);
  }

  /**
   * GET /v1/documents/by-external-reference/:externalReference
   */
  @Get('by-external-reference/:externalReference')
  findByExternalReference(
    @CurrentTenant() tenant: Tenant,
    @Param('externalReference') ref: string,
  ) {
    return this.svc.findByExternalReference(tenant.id, ref);
  }

  /**
   * POST /v1/documents/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  cancel(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    return this.svc.cancel(tenant, id, dto);
  }

  /**
   * GET /v1/documents/:id/events
   */
  @Get(':id/events')
  getEvents(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
  ) {
    return this.svc.getEvents(tenant.id, id);
  }

  /**
   * POST /v1/documents/:id/export
   */
  @Post(':id/export')
  @HttpCode(HttpStatus.ACCEPTED)
  requestExport(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
    @Body() dto: ExportDocumentDto,
  ) {
    return this.svc.requestExport(tenant, id, dto);
  }
}

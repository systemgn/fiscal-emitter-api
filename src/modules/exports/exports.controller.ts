import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { FiscalExportLog } from '../fiscal-documents/fiscal-documents.service';

@UseGuards(ApiKeyGuard)
@Controller('exports')
export class ExportsController {
  constructor(
    @InjectRepository(FiscalExportLog)
    private readonly exportLogRepo: Repository<FiscalExportLog>,
  ) {}

  /**
   * GET /v1/exports/:id
   *
   * Polling do status de uma exportação solicitada.
   * Quando status = 'ready', retorna downloadUrl com validade.
   */
  @Get(':id')
  async findById(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
  ) {
    const log = await this.exportLogRepo.findOne({
      where: { id, tenantId: tenant.id },
    });

    if (!log) {
      throw new NotFoundException(`Export ${id} not found`);
    }

    // Marca como expirada se passou da data de expiração
    if (
      log.status === 'ready' &&
      log.urlExpiresAt &&
      log.urlExpiresAt < new Date()
    ) {
      await this.exportLogRepo.update(id, { status: 'expired' });
      log.status      = 'expired';
      log.downloadUrl = null;
    }

    return {
      id:          log.id,
      documentId:  log.documentId,
      exportType:  log.exportType,
      status:      log.status,
      downloadUrl: log.status === 'ready' ? log.downloadUrl : null,
      urlExpiresAt: log.urlExpiresAt,
      errorMessage: log.errorMessage,
      createdAt:   log.createdAt,
      updatedAt:   log.updatedAt,
    };
  }
}

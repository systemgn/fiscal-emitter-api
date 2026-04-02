import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotFoundException } from '@nestjs/common';

@Entity('fiscal_exports_log')
class FiscalExportLog {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'document_id', type: 'char', length: 36 }) documentId: string;
  @Column({ name: 'tenant_id', type: 'char', length: 36 }) tenantId: string;
  @Column({ name: 'export_type', type: 'enum', enum: ['xml', 'pdf'] }) exportType: 'xml' | 'pdf';
  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'ready', 'expired', 'error'],
    default: 'pending',
  })
  status: string;
  @Column({ name: 'download_url', type: 'text', nullable: true }) downloadUrl: string | null;
  @Column({ name: 'url_expires_at', type: 'timestamp', nullable: true }) urlExpiresAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

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

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { FiscalDocument } from '../../modules/fiscal-documents/entities/fiscal-document.entity';
import {
  FISCAL_PROVIDER,
  FiscalProvider,
} from '../../modules/providers/fiscal-provider.interface';
import { ExportJobData, QUEUE_EXPORT } from '../../infrastructure/queue/queue.config';

// Export log minimal entity for worker
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('fiscal_exports_log')
class FiscalExportLog {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'document_id', type: 'char', length: 36 }) documentId: string;
  @Column({ name: 'tenant_id', type: 'char', length: 36 }) tenantId: string;
  @Column({ name: 'export_type', type: 'enum', enum: ['xml', 'pdf'] }) exportType: 'xml' | 'pdf';
  @Column({ type: 'enum', enum: ['pending', 'processing', 'ready', 'expired', 'error'], default: 'pending' }) status: string;
  @Column({ name: 'download_url', type: 'text', nullable: true }) downloadUrl: string | null;
  @Column({ name: 'url_expires_at', type: 'timestamp', nullable: true }) urlExpiresAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Processor(QUEUE_EXPORT, { concurrency: 2 })
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    @InjectRepository(FiscalDocument)
    private readonly docRepo: Repository<FiscalDocument>,

    @InjectRepository(FiscalExportLog)
    private readonly exportLogRepo: Repository<FiscalExportLog>,

    @Inject(FISCAL_PROVIDER)
    private readonly fiscalProvider: FiscalProvider,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    const { documentId, tenantId, exportLogId, exportType } = job.data;
    this.logger.log(`Processing export job ${job.id} → doc=${documentId} type=${exportType}`);

    await this.exportLogRepo.update(exportLogId, { status: 'processing' });

    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc || !doc.nfseNumber) {
      await this.exportLogRepo.update(exportLogId, {
        status: 'error',
        errorMessage: 'Document not found or has no nfseNumber',
      });
      return;
    }

    try {
      const result = await this.fiscalProvider.export({
        tenantId,
        environment:  doc.environment,
        providerCnpj: doc.providerCnpj,
        nfseNumber:   doc.nfseNumber,
        type:         exportType,
      });

      if (result.success) {
        await this.exportLogRepo.update(exportLogId, {
          status:       'ready',
          downloadUrl:  result.downloadUrl  ?? null,
          urlExpiresAt: result.urlExpiresAt ?? null,
        });
        this.logger.log(`Export ready for doc=${documentId} → ${result.downloadUrl}`);
      } else {
        await this.exportLogRepo.update(exportLogId, {
          status:       'error',
          errorMessage: result.errorMessage ?? 'Export failed',
        });
      }
    } catch (err: any) {
      await this.exportLogRepo.update(exportLogId, {
        status:       'error',
        errorMessage: err.message,
      });
      throw err;
    }
  }
}

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
import { FiscalExportLog } from '../../modules/fiscal-documents/fiscal-documents.service';

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

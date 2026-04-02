import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { FiscalDocument } from '../../modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from '../../modules/fiscal-documents/entities/fiscal-document-event.entity';
import {
  FISCAL_PROVIDER,
  FiscalProvider,
} from '../../modules/providers/fiscal-provider.interface';
import { CancelJobData, QUEUE_CANCEL } from '../../infrastructure/queue/queue.config';
import { WebhooksService } from '../../modules/webhooks/webhooks.service';

@Processor(QUEUE_CANCEL, { concurrency: 3 })
export class CancellationProcessor extends WorkerHost {
  private readonly logger = new Logger(CancellationProcessor.name);

  constructor(
    @InjectRepository(FiscalDocument)
    private readonly docRepo: Repository<FiscalDocument>,

    @InjectRepository(FiscalDocumentEvent)
    private readonly eventRepo: Repository<FiscalDocumentEvent>,

    @Inject(FISCAL_PROVIDER)
    private readonly fiscalProvider: FiscalProvider,

    private readonly webhooksService: WebhooksService,
  ) {
    super();
  }

  async process(job: Job<CancelJobData>): Promise<void> {
    const { documentId, tenantId, reason } = job.data;
    this.logger.log(`Processing cancel job ${job.id} → doc=${documentId}`);

    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc || !doc.nfseNumber) {
      this.logger.warn(`Cannot cancel doc=${documentId}: not found or missing nfseNumber`);
      return;
    }

    try {
      const result = await this.fiscalProvider.cancel({
        tenantId,
        environment:  doc.environment,
        providerCnpj: doc.providerCnpj,
        nfseNumber:   doc.nfseNumber,
        reason,
      });

      if (result.success) {
        await this.docRepo.update(documentId, {
          status:      'cancelled',
          cancelledAt: result.cancelledAt ?? new Date(),
          rawResponse: result.rawResponse ?? null,
        });
        await this.saveEvent(documentId, tenantId, 'cancelled', 'processing', 'cancelled', {
          reason,
          cancelledAt: result.cancelledAt,
        });
        this.logger.log(`Document ${documentId} cancelled`);

        // Dispara webhook document.cancelled
        const cancelledDoc = await this.docRepo.findOne({ where: { id: documentId } });
        if (cancelledDoc) {
          this.webhooksService
            .dispatch('document.cancelled', cancelledDoc)
            .catch((e) => this.logger.warn(`Webhook dispatch failed: ${e.message}`));
        }
      } else {
        await this.docRepo.update(documentId, {
          status:       'error',
          errorCode:    result.errorCode    ?? 'CANCEL_ERROR',
          errorMessage: result.errorMessage ?? 'Cancellation failed',
        });
        await this.saveEvent(documentId, tenantId, 'error', 'processing', 'error', {
          errorCode: result.errorCode,
        });
      }
    } catch (err: any) {
      this.logger.error(`Cancellation failed for doc=${documentId}: ${err.message}`);
      throw err;
    }
  }

  private async saveEvent(
    documentId: string,
    tenantId: string,
    eventType: any,
    statusFrom: string | null,
    statusTo: string | null,
    metadata?: Record<string, any>,
  ) {
    await this.eventRepo.save(
      this.eventRepo.create({ documentId, tenantId, eventType, statusFrom, statusTo, metadata }),
    );
  }
}

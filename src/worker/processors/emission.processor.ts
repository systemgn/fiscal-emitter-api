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
import { EmitJobData, QUEUE_EMIT } from '../../infrastructure/queue/queue.config';

@Processor(QUEUE_EMIT, { concurrency: 5 })
export class EmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(EmissionProcessor.name);

  constructor(
    @InjectRepository(FiscalDocument)
    private readonly docRepo: Repository<FiscalDocument>,

    @InjectRepository(FiscalDocumentEvent)
    private readonly eventRepo: Repository<FiscalDocumentEvent>,

    @Inject(FISCAL_PROVIDER)
    private readonly fiscalProvider: FiscalProvider,
  ) {
    super();
  }

  async process(job: Job<EmitJobData>): Promise<void> {
    const { documentId, tenantId } = job.data;
    this.logger.log(`Processing emit job ${job.id} → doc=${documentId}`);

    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      this.logger.warn(`Document ${documentId} not found — skipping`);
      return;
    }

    // Marca como processing
    await this.docRepo.update(documentId, { status: 'processing', retryCount: job.attemptsMade });
    await this.saveEvent(documentId, tenantId, 'processing', 'pending', 'processing');

    try {
      const result = await this.fiscalProvider.emit({
        tenantId,
        environment:      doc.environment,
        providerCnpj:     doc.providerCnpj,
        externalReference: doc.externalReference,
        taker: {
          documentType: doc.takerDocumentType,
          document:     doc.takerDocument,
          name:         doc.takerName,
          email:        doc.takerEmail ?? undefined,
          address: {
            street:     doc.takerStreet     ?? undefined,
            number:     doc.takerNumber     ?? undefined,
            complement: doc.takerComplement ?? undefined,
            district:   doc.takerDistrict   ?? undefined,
            cityCode:   doc.takerCityCode   ?? undefined,
            cityName:   doc.takerCityName   ?? undefined,
            state:      doc.takerState      ?? undefined,
            zipCode:    doc.takerZipCode    ?? undefined,
          },
        },
        service: {
          code:        doc.serviceCode,
          description: doc.serviceDescription,
          amount:      Number(doc.serviceAmount),
          taxes: {
            issRate:      Number(doc.issRate),
            deductions:   Number(doc.deductions),
            pisAmount:    Number(doc.pisAmount),
            cofinsAmount: Number(doc.cofinsAmount),
            irAmount:     Number(doc.irAmount),
            csllAmount:   Number(doc.csllAmount),
            inssAmount:   Number(doc.inssAmount),
          },
        },
        rps: {
          number: doc.nfseRpsNumber ?? undefined,
          series: doc.nfseRpsSeries ?? undefined,
          type:   doc.nfseRpsType   ?? 'RPS',
        },
      });

      if (result.success) {
        await this.docRepo.update(documentId, {
          status:       'issued',
          nfseNumber:   result.nfseNumber   ?? null,
          nfseCode:     result.nfseCode     ?? null,
          nfseIssuedAt: result.nfseIssuedAt ?? null,
          nfseRpsNumber: result.rpsNumber   ?? doc.nfseRpsNumber,
          nfseRpsSeries: result.rpsSeries   ?? doc.nfseRpsSeries,
          rawResponse:  result.rawResponse  ?? null,
          errorCode:    null,
          errorMessage: null,
        });
        await this.saveEvent(documentId, tenantId, 'issued', 'processing', 'issued', {
          nfseNumber: result.nfseNumber,
          nfseCode:   result.nfseCode,
        });
        this.logger.log(`Document ${documentId} issued → NFS-e #${result.nfseNumber}`);
      } else {
        // Erro de negócio (SEFAZ rejeitou) — não retentar
        await this.docRepo.update(documentId, {
          status:       'rejected',
          errorCode:    result.errorCode    ?? 'PROVIDER_ERROR',
          errorMessage: result.errorMessage ?? 'Provider returned error',
          rawResponse:  result.rawResponse  ?? null,
        });
        await this.saveEvent(documentId, tenantId, 'error', 'processing', 'rejected', {
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
        this.logger.warn(`Document ${documentId} rejected by SEFAZ: ${result.errorMessage}`);
        // Não lança exception — evita retry de erros de negócio
      }
    } catch (err: any) {
      this.logger.error(`Emission failed for doc=${documentId}: ${err.message}`, err.stack);

      await this.docRepo.update(documentId, {
        status:       'error',
        errorCode:    'TECHNICAL_ERROR',
        errorMessage: err.message,
        retryCount:   job.attemptsMade,
      });
      await this.saveEvent(documentId, tenantId, 'error', 'processing', 'error', {
        error: err.message,
        attempt: job.attemptsMade,
      });

      // Relança para o BullMQ gerenciar retry com backoff
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

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CancelJobData,
  EmitJobData,
  ExportJobData,
  QUEUE_CANCEL,
  QUEUE_EMIT,
  QUEUE_EXPORT,
} from './queue.config';

@Injectable()
export class EmissionProducer {
  private readonly logger = new Logger(EmissionProducer.name);

  constructor(
    @InjectQueue(QUEUE_EMIT)   private readonly emitQueue: Queue<EmitJobData>,
    @InjectQueue(QUEUE_CANCEL) private readonly cancelQueue: Queue<CancelJobData>,
    @InjectQueue(QUEUE_EXPORT) private readonly exportQueue: Queue<ExportJobData>,
  ) {}

  async enqueueEmission(data: EmitJobData): Promise<string> {
    // Remove job antigo com o mesmo ID (pode estar em 'failed') para garantir que o retry seja processado
    const jobId = `emit_${data.documentId}`;
    const existing = await this.emitQueue.getJob(jobId);
    if (existing) {
      await existing.remove().catch(() => {}); // ignora erro se já foi removido
    }

    const job = await this.emitQueue.add('emit', data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: false,
    });
    this.logger.log(`Enqueued emit job ${job.id} for document ${data.documentId}`);
    return job.id!;
  }

  async enqueueCancellation(data: CancelJobData): Promise<string> {
    const job = await this.cancelQueue.add('cancel', data, {
      jobId: `cancel_${data.documentId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: false,
    });
    this.logger.log(`Enqueued cancel job ${job.id} for document ${data.documentId}`);
    return job.id!;
  }

  async enqueueExport(data: ExportJobData): Promise<string> {
    const job = await this.exportQueue.add('export', data, {
      jobId: `export_${data.exportLogId}`,
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: false,
    });
    this.logger.log(`Enqueued export job ${job.id} for document ${data.documentId}`);
    return job.id!;
  }
}

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
    const job = await this.emitQueue.add('emit', data, {
      jobId: `emit:${data.documentId}`,
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
      jobId: `cancel:${data.documentId}`,
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
      jobId: `export:${data.exportLogId}`,
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: false,
    });
    this.logger.log(`Enqueued export job ${job.id} for document ${data.documentId}`);
    return job.id!;
  }
}

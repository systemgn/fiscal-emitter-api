import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhooksService, WebhookJobData, QUEUE_WEBHOOK } from '../../modules/webhooks/webhooks.service';

@Processor(QUEUE_WEBHOOK, { concurrency: 10 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { deliveryId } = job.data;
    this.logger.debug(`Delivering webhook job=${job.id} delivery=${deliveryId}`);
    await this.webhooksService.deliver(deliveryId);
  }
}

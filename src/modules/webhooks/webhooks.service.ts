import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { WebhookSubscription, WebhookEvent } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { CreateWebhookDto } from './dtos/create-webhook.dto';
import { FiscalDocument } from '../fiscal-documents/entities/fiscal-document.entity';

export const QUEUE_WEBHOOK = 'webhook.dispatch';

export interface WebhookJobData {
  deliveryId: string;
  subscriptionId: string;
  tenantId: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subRepo: Repository<WebhookSubscription>,

    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,

    @InjectQueue(QUEUE_WEBHOOK)
    private readonly webhookQueue: Queue<WebhookJobData>,
  ) {}

  // ── CRUD de subscriptions ─────────────────────────────────────
  async create(tenantId: string, dto: CreateWebhookDto): Promise<WebhookSubscription> {
    const secret = randomBytes(32).toString('hex');
    const sub = this.subRepo.create({
      id: uuidv4(),
      tenantId,
      name:   dto.name,
      url:    dto.url,
      secret,
      events: dto.events,
      status: 'active',
    });
    return this.subRepo.save(sub);
  }

  async findAll(tenantId: string): Promise<WebhookSubscription[]> {
    return this.subRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<WebhookSubscription> {
    const sub = await this.subRepo.findOne({ where: { id, tenantId } });
    if (!sub) throw new NotFoundException(`Webhook subscription ${id} not found`);
    return sub;
  }

  async toggleStatus(tenantId: string, id: string): Promise<WebhookSubscription> {
    const sub = await this.findOne(tenantId, id);
    sub.status = sub.status === 'active' ? 'inactive' : 'active';
    return this.subRepo.save(sub);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const sub = await this.findOne(tenantId, id);
    await this.subRepo.remove(sub);
  }

  // ── Dispatch de eventos ───────────────────────────────────────

  /**
   * Chamado após mudança de status de um documento.
   * Encontra todas as subscriptions ativas que escutam o evento
   * e enfileira uma delivery para cada uma.
   */
  async dispatch(
    eventType: WebhookEvent,
    document: FiscalDocument,
  ): Promise<void> {
    const subscriptions = await this.subRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId: document.tenantId })
      .andWhere('s.status = :status', { status: 'active' })
      .getMany();

    const matching = subscriptions.filter((s) =>
      s.events.includes(eventType),
    );

    if (matching.length === 0) return;

    const payload = this.buildPayload(eventType, document);

    for (const sub of matching) {
      const delivery = await this.deliveryRepo.save(
        this.deliveryRepo.create({
          id:             uuidv4(),
          subscriptionId: sub.id,
          documentId:     document.id,
          tenantId:       document.tenantId,
          eventType,
          payload,
          status:         'pending',
        }),
      );

      await this.webhookQueue.add(
        'dispatch',
        {
          deliveryId:     delivery.id,
          subscriptionId: sub.id,
          tenantId:       document.tenantId,
        },
        {
          jobId:    `wh:${delivery.id}`,
          attempts: 5,
          backoff:  { type: 'exponential', delay: 10_000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: false,
        },
      );
    }

    this.logger.log(
      `Dispatched event ${eventType} for doc=${document.id} to ${matching.length} subscription(s)`,
    );
  }

  /**
   * Entrega HTTP de um webhook — chamado pelo processor.
   * Assina o payload com HMAC-SHA256 e envia via POST.
   */
  async deliver(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['subscription'],
    });

    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found`);
      return;
    }

    const sub = delivery.subscription;

    if (sub.status !== 'active') {
      await this.deliveryRepo.update(deliveryId, { status: 'failed' });
      return;
    }

    const payloadStr = JSON.stringify(delivery.payload);
    const signature  = this.sign(payloadStr, sub.secret);

    try {
      const res = await axios.post(sub.url, delivery.payload, {
        timeout: 10_000,
        headers: {
          'Content-Type':         'application/json',
          'X-Webhook-Event':      delivery.eventType,
          'X-Webhook-Delivery':   delivery.id,
          'X-Webhook-Signature':  `sha256=${signature}`,
          'X-Webhook-Timestamp':  String(Date.now()),
        },
        validateStatus: () => true, // não lança em 4xx/5xx
      });

      const success = res.status >= 200 && res.status < 300;

      await this.deliveryRepo.update(deliveryId, {
        status:        success ? 'delivered' : 'failed',
        httpStatus:    res.status,
        responseBody:  String(res.data ?? '').substring(0, 500),
        attempts:      delivery.attempts + 1,
        lastAttemptAt: new Date(),
      });

      if (!success) {
        // Relança para o BullMQ fazer retry com backoff
        throw new Error(`Webhook responded with HTTP ${res.status}`);
      }

      this.logger.log(`Webhook delivered: delivery=${deliveryId} status=${res.status}`);
    } catch (err: any) {
      await this.deliveryRepo.update(deliveryId, {
        attempts:      delivery.attempts + 1,
        lastAttemptAt: new Date(),
        responseBody:  err.message?.substring(0, 500),
      });
      throw err;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  private sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private buildPayload(
    eventType: WebhookEvent,
    doc: FiscalDocument,
  ): Record<string, any> {
    return {
      event:     eventType,
      timestamp: new Date().toISOString(),
      data: {
        id:                doc.id,
        externalReference: doc.externalReference,
        status:            doc.status,
        environment:       doc.environment,
        nfseNumber:        doc.nfseNumber,
        nfseCode:          doc.nfseCode,
        nfseIssuedAt:      doc.nfseIssuedAt,
        providerCnpj:      doc.providerCnpj,
        serviceAmount:     doc.serviceAmount,
        netAmount:         doc.netAmount,
        errorCode:         doc.errorCode,
        errorMessage:      doc.errorMessage,
        createdAt:         doc.createdAt,
        updatedAt:         doc.updatedAt,
      },
    };
  }
}

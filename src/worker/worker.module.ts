import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, dbConfig, queueConfig, redisConfig } from '../config/app.config';
import { FiscalDocument } from '../modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from '../modules/fiscal-documents/entities/fiscal-document-event.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { ApiClient } from '../modules/tenants/entities/api-client.entity';
import { TenantCredential } from '../modules/tenants/entities/tenant-credential.entity';
import { WebhookSubscription } from '../modules/webhooks/entities/webhook-subscription.entity';
import { WebhookDelivery } from '../modules/webhooks/entities/webhook-delivery.entity';
import { EmissionProcessor } from './processors/emission.processor';
import { CancellationProcessor } from './processors/cancellation.processor';
import { ExportProcessor } from './processors/export.processor';
import { WebhookProcessor } from './processors/webhook.processor';
import { ProvidersModule } from '../modules/providers/providers.module';
import { WebhooksService, QUEUE_WEBHOOK } from '../modules/webhooks/webhooks.service';
import { MetricsModule } from '../infrastructure/metrics/metrics.module';
import { pinoConfig } from '../infrastructure/logger/pino.config';
import {
  QUEUE_CANCEL,
  QUEUE_EMIT,
  QUEUE_EXPORT,
} from '../infrastructure/queue/queue.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, queueConfig],
    }),

    LoggerModule.forRoot(pinoConfig()),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type:     'mysql',
        host:     cfg.get('db.host'),
        port:     cfg.get('db.port'),
        username: cfg.get('db.user'),
        password: cfg.get('db.password'),
        database: cfg.get('db.name'),
        entities: [
          FiscalDocument, FiscalDocumentEvent,
          Tenant, ApiClient, TenantCredential,
          WebhookSubscription, WebhookDelivery,
        ],
        synchronize: false,
        charset: 'utf8mb4',
      }),
    }),
    TypeOrmModule.forFeature([
      FiscalDocument, FiscalDocumentEvent,
      WebhookSubscription, WebhookDelivery,
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get('redis.host'),
          port:     cfg.get('redis.port'),
          password: cfg.get('redis.password') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_EMIT },
      { name: QUEUE_CANCEL },
      { name: QUEUE_EXPORT },
      { name: QUEUE_WEBHOOK },
    ),
    ProvidersModule,
    MetricsModule,
  ],
  providers: [
    EmissionProcessor,
    CancellationProcessor,
    ExportProcessor,
    WebhookProcessor,
    WebhooksService,
  ],
})
export class WorkerModule {}

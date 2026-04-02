import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { appConfig, dbConfig, queueConfig, redisConfig } from './config/app.config';
import { FiscalDocument } from './modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './modules/fiscal-documents/entities/fiscal-document-event.entity';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { ApiClient } from './modules/tenants/entities/api-client.entity';
import { WebhookSubscription } from './modules/webhooks/entities/webhook-subscription.entity';
import { WebhookDelivery } from './modules/webhooks/entities/webhook-delivery.entity';
import { AuthModule } from './modules/auth/auth.module';
import { FiscalDocumentsModule } from './modules/fiscal-documents/fiscal-documents.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { HealthModule } from './modules/health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ExportsModule } from './modules/exports/exports.module';
import { TenantThrottleGuard } from './common/guards/tenant-throttle.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, queueConfig],
      envFilePath: '.env',
    }),

    // Rate limiting: 120 req/min por tenant (janela de 60s)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),

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
          Tenant, ApiClient,
          WebhookSubscription, WebhookDelivery,
        ],
        synchronize: false,
        charset:  'utf8mb4',
        timezone: 'Z',
        extra: { connectionLimit: 10 },
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get('redis.host'),
          port:     cfg.get('redis.port'),
          password: cfg.get('redis.password') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff:  { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: false,
        },
      }),
    }),

    AuthModule,
    ProvidersModule,
    FiscalDocumentsModule,
    WebhooksModule,
    TenantsModule,
    ExportsModule,
    HealthModule,
  ],
  providers: [
    // Rate limit aplicado globalmente em todas as rotas
    { provide: APP_GUARD, useClass: TenantThrottleGuard },
  ],
})
export class AppModule {}

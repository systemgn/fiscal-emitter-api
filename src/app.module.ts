import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { appConfig, dbConfig, queueConfig, redisConfig } from './config/app.config';
import { FiscalDocument } from './modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './modules/fiscal-documents/entities/fiscal-document-event.entity';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { ApiClient } from './modules/tenants/entities/api-client.entity';
import { TenantCredential } from './modules/tenants/entities/tenant-credential.entity';
import { WebhookSubscription } from './modules/webhooks/entities/webhook-subscription.entity';
import { WebhookDelivery } from './modules/webhooks/entities/webhook-delivery.entity';
import { AuthModule } from './modules/auth/auth.module';
import { FiscalDocumentsModule } from './modules/fiscal-documents/fiscal-documents.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { HealthModule } from './modules/health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ExportsModule } from './modules/exports/exports.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { TenantThrottleGuard } from './common/guards/tenant-throttle.guard';
import { pinoConfig } from './infrastructure/logger/pino.config';

@Module({
  imports: [
    // Config global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, queueConfig],
      envFilePath: '.env',
    }),

    // Logger estruturado Pino
    LoggerModule.forRoot(pinoConfig()),

    // Rate limiting: 120 req/min por tenant
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    // TypeORM — MySQL
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
        synchronize:    false,
        charset:        'utf8mb4',
        timezone:       'Z',
        retryAttempts:  10,
        retryDelay:     3000,
        extra:          { connectionLimit: 10 },
      }),
    }),

    // BullMQ — Redis
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
    AdminAuthModule,
    ProvidersModule,
    FiscalDocumentsModule,
    WebhooksModule,
    TenantsModule,
    ExportsModule,
    HealthModule,
    MetricsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: TenantThrottleGuard },
  ],
})
export class AppModule {}

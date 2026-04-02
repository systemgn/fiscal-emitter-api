import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { appConfig, dbConfig, queueConfig, redisConfig } from '../config/app.config';
import { FiscalDocument } from '../modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from '../modules/fiscal-documents/entities/fiscal-document-event.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { ApiClient } from '../modules/tenants/entities/api-client.entity';
import { EmissionProcessor } from './processors/emission.processor';
import { CancellationProcessor } from './processors/cancellation.processor';
import { ExportProcessor } from './processors/export.processor';
import { ProvidersModule } from '../modules/providers/providers.module';
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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type:        'mysql',
        host:        cfg.get('db.host'),
        port:        cfg.get('db.port'),
        username:    cfg.get('db.user'),
        password:    cfg.get('db.password'),
        database:    cfg.get('db.name'),
        entities:    [FiscalDocument, FiscalDocumentEvent, Tenant, ApiClient],
        synchronize: false,
        charset:     'utf8mb4',
      }),
    }),
    TypeOrmModule.forFeature([FiscalDocument, FiscalDocumentEvent]),
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
    ),
    ProvidersModule,
  ],
  providers: [EmissionProcessor, CancellationProcessor, ExportProcessor],
})
export class WorkerModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { appConfig, dbConfig, queueConfig, redisConfig } from './config/app.config';
import { FiscalDocument } from './modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './modules/fiscal-documents/entities/fiscal-document-event.entity';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { ApiClient } from './modules/tenants/entities/api-client.entity';
import { AuthModule } from './modules/auth/auth.module';
import { FiscalDocumentsModule } from './modules/fiscal-documents/fiscal-documents.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuração global de variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, queueConfig],
      envFilePath: '.env',
    }),

    // TypeORM — MySQL
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
        timezone:    'Z',
        extra: {
          connectionLimit: 10,
        },
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
          attempts:  3,
          backoff:   { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: false,
        },
      }),
    }),

    AuthModule,
    ProvidersModule,
    FiscalDocumentsModule,
    HealthModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FiscalDocument } from './entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './entities/fiscal-document-event.entity';
import { FiscalDocumentsController } from './fiscal-documents.controller';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { AuthModule } from '../auth/auth.module';
import { EmissionProducer } from '../../infrastructure/queue/emission.producer';
import {
  QUEUE_CANCEL,
  QUEUE_EMIT,
  QUEUE_EXPORT,
} from '../../infrastructure/queue/queue.config';

// FiscalExportLog entity — referência a tabela fiscal_exports_log
// Importamos via forFeature com string para evitar dependência circular
const FISCAL_EXPORTS_LOG_ENTITY = 'fiscal_exports_log';

@Module({
  imports: [
    TypeOrmModule.forFeature([FiscalDocument, FiscalDocumentEvent]),
    BullModule.registerQueue(
      { name: QUEUE_EMIT },
      { name: QUEUE_CANCEL },
      { name: QUEUE_EXPORT },
    ),
    AuthModule,
  ],
  controllers: [FiscalDocumentsController],
  providers: [FiscalDocumentsService, EmissionProducer],
  exports: [FiscalDocumentsService],
})
export class FiscalDocumentsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportsController } from './exports.controller';
import { AuthModule } from '../auth/auth.module';
import { FiscalExportLog } from '../fiscal-documents/fiscal-documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([FiscalExportLog]), AuthModule],
  controllers: [ExportsController],
})
export class ExportsModule {}

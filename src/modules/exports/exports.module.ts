import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportsController } from './exports.controller';
import { AuthModule } from '../auth/auth.module';

// Importamos a entidade via string para evitar duplicação de declaração
// A tabela fiscal_exports_log já é mapeada no ExportsController diretamente
@Module({
  imports: [AuthModule],
  controllers: [ExportsController],
})
export class ExportsModule {}

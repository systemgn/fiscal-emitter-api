import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Executa DDL incremental no startup — equivalente ao padrão ALTER TABLE...catch() do TheraHub.
 * Cada migração é idempotente (usa IF NOT EXISTS ou ignora erro se coluna já existir).
 */
@Injectable()
export class MigrationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.run(
      'fiscal_documents.iss_withheld',
      `ALTER TABLE fiscal_documents
         ADD COLUMN iss_withheld TINYINT(1) NOT NULL DEFAULT 0
         AFTER iss_rate`,
    );
  }

  private async run(name: string, sql: string) {
    try {
      await this.dataSource.query(sql);
      this.logger.log(`Migration applied: ${name}`);
    } catch (err: any) {
      // ER_DUP_FIELDNAME (1060) = coluna já existe → ok
      if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
        this.logger.debug(`Migration already applied: ${name}`);
      } else {
        this.logger.error(`Migration failed: ${name} — ${err.message}`);
      }
    }
  }
}

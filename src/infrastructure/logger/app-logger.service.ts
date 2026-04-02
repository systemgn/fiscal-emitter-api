import { Injectable, LoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/**
 * Wrapper sobre PinoLogger que implementa LoggerService do NestJS.
 * Permite injetar no lugar do Logger padrão nos módulos que precisarem
 * de contexto estruturado (tenantId, documentId, jobId, etc.).
 *
 * Uso:
 *   constructor(private readonly log: AppLoggerService) {}
 *   this.log.info({ documentId, tenantId }, 'Document issued');
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: any, ...args: any[])   { this.logger.info(message, ...args); }
  error(message: any, ...args: any[]) { this.logger.error(message, ...args); }
  warn(message: any, ...args: any[])  { this.logger.warn(message, ...args); }
  debug(message: any, ...args: any[]) { this.logger.debug(message, ...args); }
  verbose(message: any, ...args: any[]) { this.logger.trace(message, ...args); }

  /** Log estruturado com campos extras */
  info(bindings: Record<string, any>, msg: string) {
    this.logger.assign(bindings);
    this.logger.info(msg);
  }
}

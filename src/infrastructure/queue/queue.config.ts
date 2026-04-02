import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigService } from '@nestjs/config';

export const QUEUE_EMIT   = 'fiscal.emit';
export const QUEUE_CANCEL = 'fiscal.cancel';
export const QUEUE_EXPORT = 'fiscal.export';

export function redisConnectionFromConfig(config: ConfigService) {
  return {
    host:     config.get<string>('redis.host',     'localhost'),
    port:     config.get<number>('redis.port',     6379),
    password: config.get<string>('redis.password') || undefined,
  };
}

export interface EmitJobData {
  documentId: string;
  tenantId: string;
  environment: 'sandbox' | 'production';
}

export interface CancelJobData {
  documentId: string;
  tenantId: string;
  reason: string;
}

export interface ExportJobData {
  documentId: string;
  tenantId: string;
  exportLogId: string;
  exportType: 'xml' | 'pdf';
}

import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate limiter baseado em tenant.
 * Usa tenantId como chave de rastreio no lugar do IP.
 * Configuração global: 120 req/min por tenant (via ThrottlerModule).
 */
@Injectable()
export class TenantThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const tenant = (req as any).tenant;
    // Se request tem tenant autenticado, limita por tenant; senão por IP
    return tenant?.id ?? req.ip ?? 'anonymous';
  }
}

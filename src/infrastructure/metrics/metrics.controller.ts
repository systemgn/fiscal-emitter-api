import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * GET /metrics — endpoint raspado pelo Prometheus.
 * Não usa o prefixo /v1 (configurado em main.ts via exclude).
 * Proteja com firewall/ingress em produção — não autenticar aqui para
 * não complicar o scraping do Prometheus.
 */
@Controller({ path: 'metrics', version: undefined })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metricsService.contentType());
    res.send(await this.metricsService.getMetrics());
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  // ── Contadores ────────────────────────────────────────────────────
  readonly documentsEmitted: Counter;
  readonly documentsRejected: Counter;
  readonly documentsCancelled: Counter;
  readonly documentsError: Counter;
  readonly webhooksDispatched: Counter;
  readonly webhooksDelivered: Counter;
  readonly webhooksFailed: Counter;

  // ── Histogramas de latência ────────────────────────────────────────
  readonly sefazLatency: Histogram;
  readonly emissionQueueDuration: Histogram;

  // ── Gauges (valores instantâneos) ─────────────────────────────────
  readonly pendingDocuments: Gauge;
  readonly queueDepth: Gauge;

  constructor() {
    const defaultLabels = { service: 'fiscal-emitter-api' };
    this.registry.setDefaultLabels(defaultLabels);

    this.documentsEmitted = new Counter({
      name:    'fiscal_documents_emitted_total',
      help:    'Total de NFS-e emitidas com sucesso',
      labelNames: ['tenant_id', 'environment'],
      registers: [this.registry],
    });

    this.documentsRejected = new Counter({
      name:    'fiscal_documents_rejected_total',
      help:    'Total de documentos rejeitados pela SEFAZ',
      labelNames: ['tenant_id', 'environment', 'error_code'],
      registers: [this.registry],
    });

    this.documentsCancelled = new Counter({
      name:    'fiscal_documents_cancelled_total',
      help:    'Total de NFS-e canceladas',
      labelNames: ['tenant_id', 'environment'],
      registers: [this.registry],
    });

    this.documentsError = new Counter({
      name:    'fiscal_documents_error_total',
      help:    'Total de documentos com erro técnico após todas as tentativas',
      labelNames: ['tenant_id', 'environment'],
      registers: [this.registry],
    });

    this.webhooksDispatched = new Counter({
      name:    'fiscal_webhooks_dispatched_total',
      help:    'Total de webhooks enfileirados para entrega',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.webhooksDelivered = new Counter({
      name:    'fiscal_webhooks_delivered_total',
      help:    'Total de webhooks entregues com sucesso',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.webhooksFailed = new Counter({
      name:    'fiscal_webhooks_failed_total',
      help:    'Total de webhooks com falha após todas as tentativas',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.sefazLatency = new Histogram({
      name:    'fiscal_sefaz_request_duration_seconds',
      help:    'Latência das chamadas HTTP para a SEFAZ',
      labelNames: ['operation', 'environment', 'status'],
      buckets:    [0.1, 0.3, 0.5, 1, 2, 5, 10, 30],
      registers:  [this.registry],
    });

    this.emissionQueueDuration = new Histogram({
      name:    'fiscal_emission_queue_duration_seconds',
      help:    'Tempo entre criação do documento e conclusão do processamento',
      labelNames: ['status'],
      buckets:    [1, 5, 10, 30, 60, 120, 300],
      registers:  [this.registry],
    });

    this.pendingDocuments = new Gauge({
      name:    'fiscal_documents_pending',
      help:    'Número de documentos com status pending ou processing',
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name:    'fiscal_queue_depth',
      help:    'Número de jobs aguardando nas filas BullMQ',
      labelNames: ['queue'],
      registers:  [this.registry],
    });
  }

  onModuleInit() {
    // Coleta métricas padrão do Node.js (GC, heap, event loop lag, etc.)
    collectDefaultMetrics({
      register: this.registry,
      prefix:   'fiscal_nodejs_',
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}

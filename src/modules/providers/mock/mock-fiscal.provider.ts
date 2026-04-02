import { Injectable, Logger } from '@nestjs/common';
import {
  CancelPayload,
  CancelResult,
  EmitPayload,
  EmitResult,
  ExportPayload,
  ExportResult,
  FiscalProvider,
  StatusPayload,
  StatusResult,
} from '../fiscal-provider.interface';

/**
 * Provider MOCK — simula as respostas da NFS-e Nacional.
 * Trocar por NfseNacionalProvider em produção.
 *
 * Comportamento:
 *  - emit   → sucesso 90% das chamadas; falha com MOCK_ERROR em 10%
 *  - cancel → sempre sucesso se nfseNumber presente
 *  - status → retorna 'issued' se nfseNumber presente
 *  - export → gera URL fake com validade de 15 min
 */
@Injectable()
export class MockFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger(MockFiscalProvider.name);

  async emit(payload: EmitPayload): Promise<EmitResult> {
    this.logger.debug(`[MOCK] emit → externalRef=${payload.externalReference}`);

    await this.simulateLatency(300, 800);

    // simula 10% de falha
    if (Math.random() < 0.1) {
      return {
        success: false,
        errorCode: 'MOCK_ERROR',
        errorMessage: 'Simulated random emission failure (mock)',
        rawResponse: { mock: true, simulated: 'error' },
      };
    }

    const nfseNumber = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);

    return {
      success: true,
      nfseNumber,
      nfseCode: `VER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      nfseIssuedAt: new Date(),
      rpsNumber: payload.rps?.number ?? String(Date.now()),
      rpsSeries: payload.rps?.series ?? 'A',
      rawResponse: {
        mock: true,
        environment: payload.environment,
        nfseNumber,
        issueDate: new Date().toISOString(),
      },
    };
  }

  async cancel(payload: CancelPayload): Promise<CancelResult> {
    this.logger.debug(`[MOCK] cancel → nfse=${payload.nfseNumber}`);
    await this.simulateLatency(200, 500);

    return {
      success: true,
      cancelledAt: new Date(),
      rawResponse: {
        mock: true,
        nfseNumber: payload.nfseNumber,
        reason: payload.reason,
      },
    };
  }

  async getStatus(payload: StatusPayload): Promise<StatusResult> {
    this.logger.debug(`[MOCK] getStatus → nfse=${payload.nfseNumber}`);
    await this.simulateLatency(100, 300);

    return {
      status: 'issued',
      rawResponse: { mock: true, nfseNumber: payload.nfseNumber },
    };
  }

  async export(payload: ExportPayload): Promise<ExportResult> {
    this.logger.debug(`[MOCK] export → nfse=${payload.nfseNumber} type=${payload.type}`);
    await this.simulateLatency(200, 600);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      success: true,
      downloadUrl: `https://mock-storage.example.com/nfse/${payload.nfseNumber}.${payload.type}?token=mock_${Date.now()}`,
      urlExpiresAt: expiresAt,
    };
  }

  private simulateLatency(minMs: number, maxMs: number): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise((r) => setTimeout(r, delay));
  }
}

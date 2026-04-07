import { Injectable } from '@nestjs/common';
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
} from './fiscal-provider.interface';
import { MockFiscalProvider } from './mock/mock-fiscal.provider';
import { NfseNacionalProvider } from './nfse-nacional/nfse-nacional.provider';

/**
 * Seleciona o provider correto em tempo de execução:
 *  - environment === 'production' → NfseNacionalProvider (SEFAZ real)
 *  - environment === 'sandbox'    → MockFiscalProvider (simulado)
 */
@Injectable()
export class DynamicFiscalProvider implements FiscalProvider {
  constructor(
    private readonly mock: MockFiscalProvider,
    private readonly nfseNacional: NfseNacionalProvider,
  ) {}

  private select(environment: string): FiscalProvider {
    return environment === 'production' ? this.nfseNacional : this.mock;
  }

  emit(payload: EmitPayload): Promise<EmitResult> {
    return this.select(payload.environment).emit(payload);
  }

  cancel(payload: CancelPayload): Promise<CancelResult> {
    return this.select(payload.environment).cancel(payload);
  }

  getStatus(payload: StatusPayload): Promise<StatusResult> {
    return this.select(payload.environment).getStatus(payload);
  }

  export(payload: ExportPayload): Promise<ExportResult> {
    return this.select(payload.environment).export(payload);
  }
}

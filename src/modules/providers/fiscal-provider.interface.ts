export const FISCAL_PROVIDER = Symbol('FISCAL_PROVIDER');

export interface EmitPayload {
  tenantId: string;
  environment: 'sandbox' | 'production';
  providerCnpj: string;
  externalReference: string;
  taker: {
    documentType: 'cpf' | 'cnpj';
    document: string;
    name: string;
    email?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      district?: string;
      cityCode?: string;
      cityName?: string;
      state?: string;
      zipCode?: string;
    };
  };
  service: {
    code: string;
    description: string;
    amount: number;
    taxes?: {
      issRate?: number;
      deductions?: number;
      pisAmount?: number;
      cofinsAmount?: number;
      irAmount?: number;
      csllAmount?: number;
      inssAmount?: number;
    };
  };
  rps?: {
    number?: string;
    series?: string;
    type?: string;
  };
}

export interface EmitResult {
  success: boolean;
  nfseNumber?: string;
  nfseCode?: string;
  nfseIssuedAt?: Date;
  rpsNumber?: string;
  rpsSeries?: string;
  rawResponse?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
}

export interface CancelPayload {
  tenantId: string;
  environment: 'sandbox' | 'production';
  providerCnpj: string;
  nfseNumber: string;
  reason: string;
}

export interface CancelResult {
  success: boolean;
  cancelledAt?: Date;
  rawResponse?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
}

export interface StatusPayload {
  tenantId: string;
  environment: 'sandbox' | 'production';
  providerCnpj: string;
  nfseNumber: string;
}

export interface StatusResult {
  status: 'issued' | 'cancelled' | 'processing' | 'error';
  rawResponse?: Record<string, any>;
}

export interface ExportPayload {
  tenantId: string;
  environment: 'sandbox' | 'production';
  providerCnpj: string;
  nfseNumber: string;
  type: 'xml' | 'pdf';
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  urlExpiresAt?: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface FiscalProvider {
  emit(payload: EmitPayload): Promise<EmitResult>;
  cancel(payload: CancelPayload): Promise<CancelResult>;
  getStatus(payload: StatusPayload): Promise<StatusResult>;
  export(payload: ExportPayload): Promise<ExportResult>;
}

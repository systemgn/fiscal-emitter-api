import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'issued'
  | 'cancelled'
  | 'error'
  | 'rejected';

export type DocumentEnvironment = 'sandbox' | 'production';

@Entity('fiscal_documents')
export class FiscalDocument {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId: string;

  @Column({ name: 'external_reference', length: 255 })
  externalReference: string;

  @Column({ name: 'idempotency_key', length: 64 })
  idempotencyKey: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'issued', 'cancelled', 'error', 'rejected'],
    default: 'pending',
  })
  status: DocumentStatus;

  @Column({
    type: 'enum',
    enum: ['sandbox', 'production'],
    default: 'sandbox',
  })
  environment: DocumentEnvironment;

  // ── Prestador ──────────────────────────────────────────────────
  @Column({ name: 'provider_cnpj', length: 14 })
  providerCnpj: string;

  @Column({ name: 'provider_name', length: 255 })
  providerName: string;

  // ── Tomador ────────────────────────────────────────────────────
  @Column({ name: 'taker_document_type', type: 'enum', enum: ['cpf', 'cnpj'] })
  takerDocumentType: 'cpf' | 'cnpj';

  @Column({ name: 'taker_document', length: 14 })
  takerDocument: string;

  @Column({ name: 'taker_name', length: 255 })
  takerName: string;

  @Column({ name: 'taker_email', length: 191, nullable: true })
  takerEmail: string | null;

  @Column({ name: 'taker_street', length: 255, nullable: true })
  takerStreet: string | null;

  @Column({ name: 'taker_number', length: 20, nullable: true })
  takerNumber: string | null;

  @Column({ name: 'taker_complement', length: 100, nullable: true })
  takerComplement: string | null;

  @Column({ name: 'taker_district', length: 100, nullable: true })
  takerDistrict: string | null;

  @Column({ name: 'taker_city_code', length: 10, nullable: true })
  takerCityCode: string | null;

  @Column({ name: 'taker_city_name', length: 100, nullable: true })
  takerCityName: string | null;

  @Column({ name: 'taker_state', type: 'char', length: 2, nullable: true })
  takerState: string | null;

  @Column({ name: 'taker_zip_code', length: 8, nullable: true })
  takerZipCode: string | null;

  // ── Serviço ────────────────────────────────────────────────────
  @Column({ name: 'service_code', length: 20 })
  serviceCode: string;

  @Column({ name: 'service_description', type: 'text' })
  serviceDescription: string;

  @Column({ name: 'service_amount', type: 'decimal', precision: 15, scale: 2 })
  serviceAmount: number;

  @Column({ name: 'deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  deductions: number;

  @Column({ name: 'iss_rate', type: 'decimal', precision: 7, scale: 4, default: 0 })
  issRate: number;

  @Column({ name: 'iss_withheld', type: 'tinyint', width: 1, default: 0 })
  issWithheld: boolean;

  @Column({ name: 'iss_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  issAmount: number;

  @Column({ name: 'pis_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  pisAmount: number;

  @Column({ name: 'cofins_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  cofinsAmount: number;

  @Column({ name: 'ir_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  irAmount: number;

  @Column({ name: 'csll_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  csllAmount: number;

  @Column({ name: 'inss_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  inssAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 15, scale: 2 })
  netAmount: number;

  // ── Resposta SEFAZ ─────────────────────────────────────────────
  @Column({ name: 'nfse_number', length: 50, nullable: true })
  nfseNumber: string | null;

  @Column({ name: 'nfse_code', length: 50, nullable: true })
  nfseCode: string | null;

  @Column({ name: 'nfse_issued_at', type: 'timestamp', nullable: true })
  nfseIssuedAt: Date | null;

  @Column({ name: 'nfse_rps_number', length: 50, nullable: true })
  nfseRpsNumber: string | null;

  @Column({ name: 'nfse_rps_series', length: 5, nullable: true })
  nfseRpsSeries: string | null;

  @Column({ name: 'nfse_rps_type', length: 5, nullable: true, default: 'RPS' })
  nfseRpsType: string | null;

  @Column({ name: 'cancel_reason', length: 255, nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancel_requested_at', type: 'timestamp', nullable: true })
  cancelRequestedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  // ── Controle ───────────────────────────────────────────────────
  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'raw_response', type: 'json', nullable: true })
  rawResponse: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

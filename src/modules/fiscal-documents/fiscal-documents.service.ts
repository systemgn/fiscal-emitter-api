import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { FiscalDocument } from './entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './entities/fiscal-document-event.entity';
import { EmitDocumentDto } from './dtos/emit-document.dto';
import { CancelDocumentDto } from './dtos/cancel-document.dto';
import { ExportDocumentDto } from './dtos/export-document.dto';
import { EmissionProducer } from '../../infrastructure/queue/emission.producer';
import { Tenant } from '../tenants/entities/tenant.entity';

// Export log entity (inline para simplificar)
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('fiscal_exports_log')
class FiscalExportLog {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'document_id', type: 'char', length: 36 }) documentId: string;
  @Column({ name: 'tenant_id', type: 'char', length: 36 }) tenantId: string;
  @Column({ name: 'export_type', type: 'enum', enum: ['xml', 'pdf'] }) exportType: 'xml' | 'pdf';
  @Column({ type: 'enum', enum: ['pending', 'processing', 'ready', 'expired', 'error'], default: 'pending' }) status: string;
  @Column({ name: 'download_url', type: 'text', nullable: true }) downloadUrl: string | null;
  @Column({ name: 'url_expires_at', type: 'timestamp', nullable: true }) urlExpiresAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Injectable()
export class FiscalDocumentsService {
  private readonly logger = new Logger(FiscalDocumentsService.name);

  constructor(
    @InjectRepository(FiscalDocument)
    private readonly docRepo: Repository<FiscalDocument>,

    @InjectRepository(FiscalDocumentEvent)
    private readonly eventRepo: Repository<FiscalDocumentEvent>,

    @InjectRepository(FiscalExportLog)
    private readonly exportLogRepo: Repository<FiscalExportLog>,

    private readonly producer: EmissionProducer,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // EMIT
  // ──────────────────────────────────────────────────────────────
  async emit(tenant: Tenant, dto: EmitDocumentDto): Promise<FiscalDocument> {
    const idempotencyKey = this.buildIdempotencyKey(
      tenant.id,
      dto.externalReference,
      dto,
    );

    // Idempotência — retorna documento existente se já processado
    const existing = await this.docRepo.findOne({
      where: { tenantId: tenant.id, idempotencyKey },
    });
    if (existing) {
      this.logger.log(
        `Idempotent hit for tenant=${tenant.id} extRef=${dto.externalReference}`,
      );
      return existing;
    }

    // Calcula valores tributários
    const serviceAmount = dto.service.amount;
    const deductions    = dto.service.taxes?.deductions ?? 0;
    const issRate       = dto.service.taxes?.issRate     ?? 0;
    const issBase       = serviceAmount - deductions;
    const issAmount     = parseFloat((issBase * issRate).toFixed(2));
    const pisAmount     = dto.service.taxes?.pisAmount    ?? 0;
    const cofinsAmount  = dto.service.taxes?.cofinsAmount ?? 0;
    const irAmount      = dto.service.taxes?.irAmount     ?? 0;
    const csllAmount    = dto.service.taxes?.csllAmount   ?? 0;
    const inssAmount    = dto.service.taxes?.inssAmount   ?? 0;

    const totalDeductions = issAmount + pisAmount + cofinsAmount + irAmount + csllAmount + inssAmount;
    const netAmount       = parseFloat((serviceAmount - totalDeductions).toFixed(2));

    const doc = this.docRepo.create({
      id: uuidv4(),
      tenantId:          tenant.id,
      externalReference: dto.externalReference,
      idempotencyKey,
      status:            'pending',
      environment:       dto.environment,
      providerCnpj:      dto.providerCnpj,
      providerName:      dto.providerName,
      takerDocumentType: dto.taker.documentType,
      takerDocument:     dto.taker.document,
      takerName:         dto.taker.name,
      takerEmail:        dto.taker.email ?? null,
      takerStreet:       dto.taker.address?.street       ?? null,
      takerNumber:       dto.taker.address?.number       ?? null,
      takerComplement:   dto.taker.address?.complement   ?? null,
      takerDistrict:     dto.taker.address?.district     ?? null,
      takerCityCode:     dto.taker.address?.cityCode     ?? null,
      takerCityName:     dto.taker.address?.cityName     ?? null,
      takerState:        dto.taker.address?.state        ?? null,
      takerZipCode:      dto.taker.address?.zipCode      ?? null,
      serviceCode:        dto.service.code,
      serviceDescription: dto.service.description,
      serviceAmount,
      deductions,
      issRate,
      issAmount,
      pisAmount,
      cofinsAmount,
      irAmount,
      csllAmount,
      inssAmount,
      netAmount,
      nfseRpsNumber: dto.rps?.number ?? null,
      nfseRpsSeries: dto.rps?.series ?? null,
      nfseRpsType:   dto.rps?.type   ?? 'RPS',
    });

    await this.docRepo.save(doc);

    await this.logEvent(doc.id, tenant.id, 'emission_requested', null, 'pending', {
      externalReference: dto.externalReference,
    });

    const jobId = await this.producer.enqueueEmission({
      documentId:  doc.id,
      tenantId:    tenant.id,
      environment: dto.environment,
    });

    this.logger.log(`Document ${doc.id} queued for emission → job ${jobId}`);
    return doc;
  }

  // ──────────────────────────────────────────────────────────────
  // GET BY ID
  // ──────────────────────────────────────────────────────────────
  async findById(tenantId: string, documentId: string): Promise<FiscalDocument> {
    const doc = await this.docRepo.findOne({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);
    return doc;
  }

  // ──────────────────────────────────────────────────────────────
  // GET BY EXTERNAL REFERENCE
  // ──────────────────────────────────────────────────────────────
  async findByExternalReference(
    tenantId: string,
    externalReference: string,
  ): Promise<FiscalDocument> {
    const doc = await this.docRepo.findOne({
      where: { tenantId, externalReference },
    });
    if (!doc)
      throw new NotFoundException(
        `Document with externalReference=${externalReference} not found`,
      );
    return doc;
  }

  // ──────────────────────────────────────────────────────────────
  // CANCEL
  // ──────────────────────────────────────────────────────────────
  async cancel(
    tenant: Tenant,
    documentId: string,
    dto: CancelDocumentDto,
  ): Promise<FiscalDocument> {
    const doc = await this.findById(tenant.id, documentId);

    if (doc.status !== 'issued') {
      throw new BadRequestException(
        `Cannot cancel document with status '${doc.status}'. Only 'issued' documents can be cancelled.`,
      );
    }

    await this.docRepo.update(doc.id, {
      status:             'processing',
      cancelReason:       dto.reason,
      cancelRequestedAt:  new Date(),
    });

    await this.logEvent(doc.id, tenant.id, 'cancelled', 'issued', 'processing', {
      reason: dto.reason,
    });

    await this.producer.enqueueCancellation({
      documentId: doc.id,
      tenantId:   tenant.id,
      reason:     dto.reason,
    });

    return this.findById(tenant.id, documentId);
  }

  // ──────────────────────────────────────────────────────────────
  // EVENTS
  // ──────────────────────────────────────────────────────────────
  async getEvents(
    tenantId: string,
    documentId: string,
  ): Promise<FiscalDocumentEvent[]> {
    await this.findById(tenantId, documentId); // garante existência e ownership
    return this.eventRepo.find({
      where: { documentId },
      order: { createdAt: 'ASC' },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────────────────────
  async requestExport(
    tenant: Tenant,
    documentId: string,
    dto: ExportDocumentDto,
  ): Promise<{ exportLogId: string }> {
    const doc = await this.findById(tenant.id, documentId);

    if (doc.status !== 'issued') {
      throw new BadRequestException(
        `Cannot export document with status '${doc.status}'. Only 'issued' documents can be exported.`,
      );
    }

    const logId = uuidv4();
    const exportLog = this.exportLogRepo.create({
      id:         logId,
      documentId: doc.id,
      tenantId:   tenant.id,
      exportType: dto.type,
      status:     'pending',
    });
    await this.exportLogRepo.save(exportLog);

    await this.logEvent(doc.id, tenant.id, 'export_requested', null, null, {
      type: dto.type,
      exportLogId: logId,
    });

    await this.producer.enqueueExport({
      documentId:   doc.id,
      tenantId:     tenant.id,
      exportLogId:  logId,
      exportType:   dto.type,
    });

    return { exportLogId: logId };
  }

  // ──────────────────────────────────────────────────────────────
  // RETRY MANUAL
  // ──────────────────────────────────────────────────────────────
  async retry(tenant: Tenant, documentId: string): Promise<FiscalDocument> {
    const doc = await this.findById(tenant.id, documentId);

    if (!['error', 'rejected'].includes(doc.status)) {
      throw new BadRequestException(
        `Cannot retry document with status '${doc.status}'. Only 'error' or 'rejected' documents can be retried.`,
      );
    }

    await this.docRepo.update(documentId, {
      status:       'pending',
      errorCode:    null,
      errorMessage: null,
      retryCount:   doc.retryCount + 1,
    });

    await this.logEvent(documentId, tenant.id, 'retry', doc.status, 'pending', {
      previousStatus: doc.status,
      manualRetry:    true,
    });

    await this.producer.enqueueEmission({
      documentId,
      tenantId:    tenant.id,
      environment: doc.environment,
    });

    this.logger.log(`Manual retry for document ${documentId} (was: ${doc.status})`);
    return this.findById(tenant.id, documentId);
  }

  // ──────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────
  private buildIdempotencyKey(
    tenantId: string,
    externalReference: string,
    payload: object,
  ): string {
    const raw = `${tenantId}|${externalReference}|${JSON.stringify(payload)}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  async logEvent(
    documentId: string,
    tenantId: string,
    eventType: any,
    statusFrom: string | null,
    statusTo: string | null,
    metadata?: Record<string, any>,
    message?: string,
  ): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({
        documentId,
        tenantId,
        eventType,
        statusFrom,
        statusTo,
        message:  message ?? null,
        metadata: metadata ?? null,
      }),
    );
  }
}

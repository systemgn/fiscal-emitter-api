import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FiscalDocumentsService, FiscalExportLog } from './fiscal-documents.service';
import { FiscalDocument } from './entities/fiscal-document.entity';
import { FiscalDocumentEvent } from './entities/fiscal-document-event.entity';
import { EmissionProducer } from '../../infrastructure/queue/emission.producer';
import { QUEUE_EMIT, QUEUE_CANCEL, QUEUE_EXPORT } from '../../infrastructure/queue/queue.config';
import { EmitDocumentDto } from './dtos/emit-document.dto';
import { Tenant } from '../tenants/entities/tenant.entity';

const mockTenant: Tenant = {
  id: 'tenant-001',
  name: 'Demo',
  document: '12345678000195',
  email: 'demo@test.com',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseEmitDto: EmitDocumentDto = {
  externalReference: 'PEDIDO-001',
  environment: 'sandbox',
  providerCnpj: '12345678000195',
  providerName: 'Demo Ltda',
  taker: {
    documentType: 'cpf',
    document: '12345678901',
    name: 'João Silva',
  },
  service: {
    code: '17.06',
    description: 'Consultoria',
    amount: 1000,
    taxes: { issRate: 0.05 },
  },
};

const savedDoc: Partial<FiscalDocument> = {
  id: 'doc-001',
  tenantId: 'tenant-001',
  externalReference: 'PEDIDO-001',
  status: 'pending',
  environment: 'sandbox',
  serviceAmount: 1000,
  netAmount: 950,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FiscalDocumentsService', () => {
  let service: FiscalDocumentsService;

  const mockDocRepo = {
    findOne: jest.fn(),
    create:  jest.fn().mockImplementation((dto) => dto),
    save:    jest.fn().mockResolvedValue(savedDoc),
    update:  jest.fn().mockResolvedValue({}),
  };

  const mockEventRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save:   jest.fn().mockResolvedValue({}),
    find:   jest.fn().mockResolvedValue([]),
  };

  const mockExportLogRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save:   jest.fn().mockResolvedValue({ id: 'export-001' }),
    update: jest.fn(),
  };

  const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-001' }) };

  const mockProducer = {
    enqueueEmission:    jest.fn().mockResolvedValue('job-001'),
    enqueueCancellation: jest.fn().mockResolvedValue('job-002'),
    enqueueExport:      jest.fn().mockResolvedValue('job-003'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiscalDocumentsService,
        { provide: getRepositoryToken(FiscalDocument),      useValue: mockDocRepo },
        { provide: getRepositoryToken(FiscalDocumentEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(FiscalExportLog), useValue: mockExportLogRepo },
        { provide: EmissionProducer, useValue: mockProducer },
        { provide: getQueueToken(QUEUE_EMIT),   useValue: mockQueue },
        { provide: getQueueToken(QUEUE_CANCEL), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_EXPORT), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<FiscalDocumentsService>(FiscalDocumentsService);
    jest.clearAllMocks();
  });

  describe('emit', () => {
    it('cria documento e enfileira job quando não há idempotência', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(null);  // sem doc existente
      mockDocRepo.save.mockResolvedValueOnce(savedDoc);

      const result = await service.emit(mockTenant, baseEmitDto);

      expect(mockDocRepo.save).toHaveBeenCalled();
      expect(mockProducer.enqueueEmission).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-001', environment: 'sandbox' }),
      );
      expect(result).toBeDefined();
    });

    it('retorna documento existente (idempotência hit)', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(savedDoc as FiscalDocument);

      const result = await service.emit(mockTenant, baseEmitDto);

      expect(mockDocRepo.save).not.toHaveBeenCalled();
      expect(mockProducer.enqueueEmission).not.toHaveBeenCalled();
      expect(result.id).toBe('doc-001');
    });

    it('calcula ISS corretamente (5% sobre 1000 = 50)', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(null);

      let capturedDoc: any;
      mockDocRepo.save.mockImplementationOnce((doc) => {
        capturedDoc = doc;
        return Promise.resolve({ ...doc, id: 'doc-001' });
      });

      await service.emit(mockTenant, baseEmitDto);

      expect(Number(capturedDoc.issAmount)).toBeCloseTo(50, 2);
      expect(Number(capturedDoc.netAmount)).toBeCloseTo(950, 2);
    });
  });

  describe('findById', () => {
    it('retorna documento existente do tenant', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(savedDoc as FiscalDocument);
      const result = await service.findById('tenant-001', 'doc-001');
      expect(result.id).toBe('doc-001');
    });

    it('lança NotFoundException se não encontrado', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('tenant-001', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('lança BadRequestException se status não é issued', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce({ ...savedDoc, status: 'pending' } as FiscalDocument);
      await expect(
        service.cancel(mockTenant, 'doc-001', { reason: 'teste' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enfileira cancelamento para documento emitido', async () => {
      mockDocRepo.findOne
        .mockResolvedValueOnce({ ...savedDoc, status: 'issued', nfseNumber: '123' } as FiscalDocument)
        .mockResolvedValueOnce({ ...savedDoc, status: 'processing' } as FiscalDocument);

      await service.cancel(mockTenant, 'doc-001', { reason: 'Cancelado' });

      expect(mockProducer.enqueueCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: 'doc-001', reason: 'Cancelado' }),
      );
    });
  });
});

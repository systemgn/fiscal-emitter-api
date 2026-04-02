import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { FiscalDocumentsController } from '../src/modules/fiscal-documents/fiscal-documents.controller';
import { FiscalDocumentsService } from '../src/modules/fiscal-documents/fiscal-documents.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ApiKeyGuard } from '../src/modules/auth/guards/api-key.guard';
import { FiscalDocument } from '../src/modules/fiscal-documents/entities/fiscal-document.entity';
import { FiscalDocumentEvent } from '../src/modules/fiscal-documents/entities/fiscal-document-event.entity';
import { EmissionProducer } from '../src/infrastructure/queue/emission.producer';
import { QUEUE_EMIT, QUEUE_CANCEL, QUEUE_EXPORT } from '../src/infrastructure/queue/queue.config';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { ApiClient } from '../src/modules/tenants/entities/api-client.entity';

const mockTenant: Tenant = {
  id: 'tenant-e2e-001',
  name: 'E2E Tenant',
  document: '12345678000195',
  email: 'e2e@test.com',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const savedDoc = {
  id: 'doc-e2e-001',
  tenantId: 'tenant-e2e-001',
  externalReference: 'E2E-001',
  status: 'pending',
  environment: 'sandbox',
  serviceAmount: 1500,
  issAmount: 75,
  netAmount: 1425,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Documents (e2e)', () => {
  let app: INestApplication;

  const mockDocRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create:  jest.fn().mockImplementation((d) => d),
    save:    jest.fn().mockResolvedValue(savedDoc),
    update:  jest.fn(),
    find:    jest.fn().mockResolvedValue([]),
  };

  const mockEventRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save:   jest.fn().mockResolvedValue({}),
    find:   jest.fn().mockResolvedValue([]),
  };

  const mockExportLogRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save:   jest.fn().mockResolvedValue({ id: 'export-001' }),
  };

  const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'j1' }) };

  const mockProducer = {
    enqueueEmission:     jest.fn().mockResolvedValue('j1'),
    enqueueCancellation: jest.fn().mockResolvedValue('j2'),
    enqueueExport:       jest.fn().mockResolvedValue('j3'),
  };

  // Guard que injeta mockTenant sem chamar o banco
  const mockApiKeyGuard = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().tenant = mockTenant;
      return true;
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiscalDocumentsController],
      providers: [
        FiscalDocumentsService,
        EmissionProducer,
        AuthService,
        { provide: getRepositoryToken(FiscalDocument),      useValue: mockDocRepo },
        { provide: getRepositoryToken(FiscalDocumentEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken('fiscal_exports_log'), useValue: mockExportLogRepo },
        { provide: getRepositoryToken(ApiClient), useValue: {} },
        { provide: getRepositoryToken(Tenant),    useValue: {} },
        { provide: getQueueToken(QUEUE_EMIT),   useValue: mockQueue },
        { provide: getQueueToken(QUEUE_CANCEL), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_EXPORT), useValue: mockQueue },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/documents/emit', () => {
    const emitBody = {
      externalReference: 'E2E-001',
      environment: 'sandbox',
      providerCnpj: '12345678000195',
      providerName: 'Demo Ltda',
      taker: {
        documentType: 'cpf',
        document: '12345678901',
        name: 'João Silva',
        email: 'joao@test.com',
      },
      service: {
        code: '17.06',
        description: 'Consultoria em TI',
        amount: 1500,
        taxes: { issRate: 0.05 },
      },
    };

    it('retorna 202 com documento criado', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .post('/v1/documents/emit')
        .send(emitBody)
        .expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeNull();
      expect(res.body.meta.path).toContain('/documents/emit');
    });

    it('retorna 202 com documento existente em hit de idempotência', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(savedDoc as any);

      const res = await request(app.getHttpServer())
        .post('/v1/documents/emit')
        .send(emitBody)
        .expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('doc-e2e-001');
      expect(mockProducer.enqueueEmission).not.toHaveBeenCalled();
    });

    it('retorna 400 com body inválido (amount negativo)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/documents/emit')
        .send({ ...emitBody, service: { ...emitBody.service, amount: -100 } })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('retorna 400 sem externalReference', async () => {
      const { externalReference: _, ...noRef } = emitBody;
      await request(app.getHttpServer())
        .post('/v1/documents/emit')
        .send(noRef)
        .expect(400);
    });
  });

  describe('GET /v1/documents/:id', () => {
    it('retorna 200 com documento existente', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(savedDoc as any);

      const res = await request(app.getHttpServer())
        .get('/v1/documents/doc-e2e-001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('doc-e2e-001');
    });

    it('retorna 404 para documento inexistente', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .get('/v1/documents/nao-existe')
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /v1/documents/:id/events', () => {
    it('retorna lista de eventos', async () => {
      mockDocRepo.findOne.mockResolvedValueOnce(savedDoc as any);
      mockEventRepo.find.mockResolvedValueOnce([
        { id: 1, eventType: 'emission_requested', createdAt: new Date() },
      ]);

      const res = await request(app.getHttpServer())
        .get('/v1/documents/doc-e2e-001/events')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

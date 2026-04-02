import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { ApiClient } from '../tenants/entities/api-client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

const mockTenant: Tenant = {
  id: 'tenant-001',
  name: 'Empresa Demo',
  document: '12345678000195',
  email: 'demo@empresa.com',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockApiClient: ApiClient = {
  id: 'client-001',
  tenantId: 'tenant-001',
  name: 'Test Client',
  apiKey: 'test_key_001',
  apiSecretHash: '', // preenchido no beforeAll
  status: 'active',
  lastUsedAt: null,
  tenant: mockTenant,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  const apiSecret = 'super_secret_plain';

  const mockApiClientRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };

  const mockTenantRepo = {
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    mockApiClient.apiSecretHash = await bcrypt.hash(apiSecret, 10);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(ApiClient), useValue: mockApiClientRepo },
        { provide: getRepositoryToken(Tenant),    useValue: mockTenantRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateApiCredentials', () => {
    it('retorna tenant e apiClient com credenciais válidas', async () => {
      mockApiClientRepo.findOne.mockResolvedValue(mockApiClient);
      mockTenantRepo.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateApiCredentials('test_key_001', apiSecret);

      expect(result.tenant.id).toBe('tenant-001');
      expect(result.apiClient.id).toBe('client-001');
    });

    it('lança UnauthorizedException se api_key não existe', async () => {
      mockApiClientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateApiCredentials('invalid_key', 'any'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se secret está incorreto', async () => {
      mockApiClientRepo.findOne.mockResolvedValue(mockApiClient);

      await expect(
        service.validateApiCredentials('test_key_001', 'wrong_secret'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se tenant está inativo', async () => {
      mockApiClientRepo.findOne.mockResolvedValue(mockApiClient);
      mockTenantRepo.findOne.mockResolvedValue(null); // findOne com status=active retorna null

      await expect(
        service.validateApiCredentials('test_key_001', apiSecret),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('atualiza last_used_at de forma não bloqueante', async () => {
      mockApiClientRepo.findOne.mockResolvedValue(mockApiClient);
      mockTenantRepo.findOne.mockResolvedValue(mockTenant);

      await service.validateApiCredentials('test_key_001', apiSecret);

      // update chamado de forma assíncrona, mas não bloqueia a resposta
      await new Promise((r) => setTimeout(r, 50));
      expect(mockApiClientRepo.update).toHaveBeenCalledWith(
        'client-001',
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });
  });
});

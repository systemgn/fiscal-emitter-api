import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from './entities/tenant.entity';
import { ApiClient } from './entities/api-client.entity';
import { CreateApiClientDto, CreateTenantDto } from './dtos/create-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(ApiClient)
    private readonly clientRepo: Repository<ApiClient>,
  ) {}

  // ── Tenants ───────────────────────────────────────────────────

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const exists = await this.tenantRepo.findOne({
      where: [{ document: dto.document }, { email: dto.email }],
    });
    if (exists) {
      throw new ConflictException('Tenant with this document or email already exists');
    }

    const tenant = this.tenantRepo.create({
      id:       uuidv4(),
      name:     dto.name,
      document: dto.document,
      email:    dto.email,
      status:   'active',
    });

    return this.tenantRepo.save(tenant);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const t = await this.tenantRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Tenant ${id} not found`);
    return t;
  }

  async toggleStatus(id: string): Promise<Tenant> {
    const t = await this.findOne(id);
    t.status = t.status === 'active' ? 'inactive' : 'active';
    return this.tenantRepo.save(t);
  }

  // ── API Clients ───────────────────────────────────────────────

  /**
   * Gera um par api_key + api_secret para o tenant.
   * O secret é retornado UMA única vez em texto puro — não é recuperável depois.
   */
  async createApiClient(
    tenantId: string,
    dto: CreateApiClientDto,
  ): Promise<{ apiClient: ApiClient; apiSecret: string }> {
    await this.findOne(tenantId);

    const apiKey    = `fea_${randomBytes(24).toString('hex')}`; // prefixo fea_ = fiscal emitter api
    const apiSecret = randomBytes(32).toString('hex');

    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const apiSecretHash = await bcrypt.hash(apiSecret, bcryptRounds);

    const client = this.clientRepo.create({
      id:            uuidv4(),
      tenantId,
      name:          dto.name,
      apiKey,
      apiSecretHash,
      status:        'active',
    });

    await this.clientRepo.save(client);

    this.logger.log(`API client created for tenant=${tenantId} key=${apiKey}`);

    return { apiClient: client, apiSecret };
  }

  async listApiClients(tenantId: string): Promise<Omit<ApiClient, 'apiSecretHash'>[]> {
    const clients = await this.clientRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return clients.map(({ apiSecretHash: _, ...c }) => c);
  }

  async revokeApiClient(tenantId: string, clientId: string): Promise<void> {
    const c = await this.clientRepo.findOne({ where: { id: clientId, tenantId } });
    if (!c) throw new NotFoundException(`API client ${clientId} not found`);
    await this.clientRepo.update(clientId, { status: 'inactive' });
    this.logger.log(`API client ${clientId} revoked`);
  }
}

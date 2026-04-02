import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiClient } from '../tenants/entities/api-client.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepo: Repository<ApiClient>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async validateApiCredentials(
    apiKey: string,
    apiSecret: string,
  ): Promise<{ tenant: Tenant; apiClient: ApiClient }> {
    const client = await this.apiClientRepo.findOne({
      where: { apiKey, status: 'active' },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid API credentials');
    }

    const secretValid = await bcrypt.compare(apiSecret, client.apiSecretHash);
    if (!secretValid) {
      throw new UnauthorizedException('Invalid API credentials');
    }

    const tenant = await this.tenantRepo.findOne({
      where: { id: client.tenantId, status: 'active' },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant inactive or not found');
    }

    // atualiza last_used_at de forma não bloqueante
    this.apiClientRepo
      .update(client.id, { lastUsedAt: new Date() })
      .catch((err) => this.logger.warn('Could not update last_used_at', err));

    return { tenant, apiClient: client };
  }
}

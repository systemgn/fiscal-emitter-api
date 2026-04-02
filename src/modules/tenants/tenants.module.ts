import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { ApiClient } from './entities/api-client.entity';
import { TenantCredential } from './entities/tenant-credential.entity';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, ApiClient, TenantCredential]), AdminAuthModule],
  controllers: [TenantsController, CredentialsController],
  providers: [TenantsService, CredentialsService],
  exports: [TenantsService, CredentialsService],
})
export class TenantsModule {}

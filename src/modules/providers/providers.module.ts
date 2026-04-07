import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FISCAL_PROVIDER } from './fiscal-provider.interface';
import { MockFiscalProvider } from './mock/mock-fiscal.provider';
import { NfseNacionalProvider } from './nfse-nacional/nfse-nacional.provider';
import { DynamicFiscalProvider } from './dynamic-fiscal.provider';
import { TenantCredential } from '../tenants/entities/tenant-credential.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TenantCredential]),
  ],
  providers: [
    MockFiscalProvider,
    NfseNacionalProvider,
    DynamicFiscalProvider,
    {
      provide: FISCAL_PROVIDER,
      useClass: DynamicFiscalProvider,
    },
  ],
  exports: [FISCAL_PROVIDER],
})
export class ProvidersModule {}

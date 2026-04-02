import { Module } from '@nestjs/common';
import { FISCAL_PROVIDER } from './fiscal-provider.interface';
import { MockFiscalProvider } from './mock/mock-fiscal.provider';

@Module({
  providers: [
    {
      provide: FISCAL_PROVIDER,
      useClass: MockFiscalProvider,
      // Em produção: useClass: NfseNacionalProvider
    },
  ],
  exports: [FISCAL_PROVIDER],
})
export class ProvidersModule {}

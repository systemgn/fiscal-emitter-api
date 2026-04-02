import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { setupBullBoard } from './infrastructure/bull-board/bull-board.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app    = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const prefix = process.env.API_PREFIX ?? 'v1';
  app.setGlobalPrefix(prefix, {
    // Admin queues board fica fora do prefixo v1
    exclude: ['admin/queues(.*)'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Bull Board — painel de filas (apenas em desenvolvimento ou com BULL_BOARD_ENABLED=true)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.BULL_BOARD_ENABLED === 'true'
  ) {
    setupBullBoard(app);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Fiscal Emitter API v2 listening on port ${port}`);
  logger.log(`Health:     http://localhost:${port}/${prefix}/health`);
  logger.log(`Bull Board: http://localhost:${port}/admin/queues`);
  logger.log(`Admin API:  http://localhost:${port}/${prefix}/admin/tenants`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { setupBullBoard } from './infrastructure/bull-board/bull-board.setup';
import { setupSwagger } from './infrastructure/swagger/swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Usa Pino como logger padrão do NestJS (substitui o Logger nativo)
  app.useLogger(app.get(Logger));

  const prefix = process.env.API_PREFIX ?? 'v1';
  app.setGlobalPrefix(prefix, {
    exclude: ['metrics', 'admin/queues(.*)'],
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

  // Swagger — apenas em não-produção ou com SWAGGER_ENABLED=true
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  ) {
    setupSwagger(app);
  }

  // Bull Board — painel de filas
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.BULL_BOARD_ENABLED === 'true'
  ) {
    setupBullBoard(app);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Fiscal Emitter API v3 on :${port}`);
  logger.log(`Docs:       http://localhost:${port}/${prefix}/docs`);
  logger.log(`Health:     http://localhost:${port}/${prefix}/health`);
  logger.log(`Metrics:    http://localhost:${port}/metrics`);
  logger.log(`Bull Board: http://localhost:${port}/admin/queues`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});

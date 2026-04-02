import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app    = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const prefix = process.env.API_PREFIX ?? 'v1';
  app.setGlobalPrefix(prefix);

  // Validação automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  // Padrão de resposta uniforme
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Handler global de erros
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Fiscal Emitter API listening on port ${port}`);
  logger.log(`Health: http://localhost:${port}/${prefix}/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});

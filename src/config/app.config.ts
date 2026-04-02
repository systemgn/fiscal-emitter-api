import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'v1',
}));

export const dbConfig = registerAs('db', () => ({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '3306', 10),
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  name:     process.env.DB_NAME     ?? 'fiscal_emitter',
}));

export const redisConfig = registerAs('redis', () => ({
  host:     process.env.REDIS_HOST     ?? 'localhost',
  port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
}));

export const queueConfig = registerAs('queue', () => ({
  emitConcurrency:   parseInt(process.env.QUEUE_EMIT_CONCURRENCY   ?? '5', 10),
  cancelConcurrency: parseInt(process.env.QUEUE_CANCEL_CONCURRENCY ?? '3', 10),
  exportConcurrency: parseInt(process.env.QUEUE_EXPORT_CONCURRENCY ?? '2', 10),
  maxAttempts:       parseInt(process.env.QUEUE_MAX_ATTEMPTS        ?? '3', 10),
  backoffDelay:      parseInt(process.env.QUEUE_BACKOFF_DELAY       ?? '5000', 10),
}));

export const nfseConfig = registerAs('nfse', () => ({
  sandboxUrl:    process.env.NFSE_NACIONAL_SANDBOX_URL    ?? 'https://sandbox.nfse.gov.br',
  productionUrl: process.env.NFSE_NACIONAL_PRODUCTION_URL ?? 'https://nfse.gov.br',
}));

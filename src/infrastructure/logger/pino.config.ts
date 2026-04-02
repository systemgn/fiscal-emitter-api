import { Params } from 'nestjs-pino';

export function pinoConfig(): Params {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

      // Formato humano em dev, JSON estruturado em produção
      transport: isDev
        ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
        : undefined,

      // Campos adicionados a cada log de request HTTP
      customProps: (req: any) => ({
        tenantId:  req.tenant?.id  ?? 'anonymous',
        requestId: req.headers?.['x-request-id'] ?? undefined,
      }),

      // Serializa request/response de forma enxuta
      serializers: {
        req(req) {
          return {
            method: req.method,
            url:    req.url,
            id:     req.id,
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },

      // Não loga health checks para não poluir
      autoLogging: {
        ignore: (req: any) => req.url?.includes('/health'),
      },

      // Campos extras em produção
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },

      // Campos base presentes em todos os logs
      base: {
        service: 'fiscal-emitter-api',
        env:     process.env.NODE_ENV ?? 'development',
        version: process.env.npm_package_version ?? '3.0.0',
      },
    },
  };
}

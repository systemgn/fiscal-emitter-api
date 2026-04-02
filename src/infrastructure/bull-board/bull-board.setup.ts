import { INestApplication, Logger } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Request, Response, NextFunction } from 'express';
import {
  QUEUE_EMIT,
  QUEUE_CANCEL,
  QUEUE_EXPORT,
} from '../queue/queue.config';
import { QUEUE_WEBHOOK } from '../../modules/webhooks/webhooks.service';

/**
 * Monta o Bull Board no Express app com autenticação básica.
 *
 * Acesso: /admin/queues
 * Credenciais: BULL_BOARD_USER / BULL_BOARD_PASS (env vars)
 *
 * Em produção: substituir por autenticação mais robusta (SSO, JWT).
 */
export function setupBullBoard(app: INestApplication): void {
  const logger = new Logger('BullBoard');

  const user = process.env.BULL_BOARD_USER ?? 'admin';
  const pass = process.env.BULL_BOARD_PASS ?? 'changeme';

  if (pass === 'changeme') {
    logger.warn('Bull Board using default password! Set BULL_BOARD_PASS in production.');
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  // Obtém instâncias de fila registradas no BullMQ
  const queues = [QUEUE_EMIT, QUEUE_CANCEL, QUEUE_EXPORT, QUEUE_WEBHOOK].map(
    (name) =>
      new BullMQAdapter(
        new Queue(name, {
          connection: {
            host:     process.env.REDIS_HOST     ?? 'localhost',
            port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
            password: process.env.REDIS_PASSWORD  || undefined,
          },
        }),
      ) as any,
  );

  createBullBoard({ queues, serverAdapter });

  // Middleware de Basic Auth
  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }
    const [u, p] = Buffer.from(authHeader.slice(6), 'base64')
      .toString()
      .split(':');
    if (u !== user || p !== pass) {
      res.status(401).send('Invalid credentials');
      return;
    }
    next();
  };

  const httpAdapter = app.getHttpAdapter();
  const expressApp  = httpAdapter.getInstance();

  expressApp.use('/admin/queues', basicAuth, serverAdapter.getRouter());

  logger.log('Bull Board available at /admin/queues');
}

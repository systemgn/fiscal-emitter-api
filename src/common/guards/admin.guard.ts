import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Protege rotas administrativas via header X-Admin-Key.
 * A chave é configurada via env ADMIN_KEY.
 * Em produção: substituir por JWT com role admin.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request  = context.switchToHttp().getRequest<Request>();
    const adminKey = request.headers['x-admin-key'] as string;
    const expected = process.env.ADMIN_KEY;

    if (!expected) {
      throw new UnauthorizedException('Admin key not configured on server');
    }

    if (!adminKey || adminKey !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req    = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = header.slice(7);

    try {
      const payload = this.jwt.verify(token, {
        issuer: 'fiscal-emitter-api',
      });

      if (payload.role !== 'admin') {
        throw new UnauthorizedException('Insufficient role');
      }

      (req as any).adminPayload = payload;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException(
        err.message ?? 'Invalid or expired token',
      );
    }
  }
}

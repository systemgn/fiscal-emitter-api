import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const apiKey    = request.headers['x-api-key']    as string;
    const apiSecret = request.headers['x-api-secret'] as string;

    if (!apiKey || !apiSecret) {
      throw new UnauthorizedException(
        'Missing x-api-key or x-api-secret headers',
      );
    }

    const { tenant, apiClient } =
      await this.authService.validateApiCredentials(apiKey, apiSecret);

    // injeta no request para uso nos controllers/services
    (request as any).tenant    = tenant;
    (request as any).apiClient = apiClient;

    return true;
  }
}

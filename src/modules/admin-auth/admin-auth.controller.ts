import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AdminAuthService } from './admin-auth.service';

class AdminLoginDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() password: string;
}

@ApiTags('Admin — Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly svc: AdminAuthService) {}

  /**
   * POST /v1/admin/auth/login
   *
   * Retorna JWT válido por 8h. Use como Bearer token nas rotas /v1/admin/*.
   *
   * Configurar no Railway:
   *   ADMIN_USERNAME=admin
   *   ADMIN_PASSWORD_HASH=$(node -e "require('bcrypt').hash('suasenha',10).then(console.log)")
   *   JWT_SECRET=<string aleatório longo>
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login admin — retorna JWT Bearer token' })
  login(@Body() dto: AdminLoginDto) {
    return this.svc.login(dto);
  }
}

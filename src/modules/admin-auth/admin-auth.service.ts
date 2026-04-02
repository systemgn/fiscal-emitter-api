import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface AdminLoginDto {
  username: string;
  password: string;
}

@Injectable()
export class AdminAuthService {
  constructor(private readonly jwt: JwtService) {}

  /**
   * Valida credenciais admin contra variáveis de ambiente.
   * ADMIN_USERNAME e ADMIN_PASSWORD_HASH (bcrypt hash).
   *
   * Para gerar o hash da senha:
   *   node -e "require('bcrypt').hash('suasenha', 10).then(console.log)"
   */
  async login(dto: AdminLoginDto): Promise<{ accessToken: string }> {
    const expectedUser = process.env.ADMIN_USERNAME ?? 'admin';
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!passwordHash) {
      throw new UnauthorizedException(
        'ADMIN_PASSWORD_HASH not configured. Set it in environment variables.',
      );
    }

    if (dto.username !== expectedUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwt.sign({
      sub:  'admin',
      role: 'admin',
    });

    return { accessToken };
  }
}

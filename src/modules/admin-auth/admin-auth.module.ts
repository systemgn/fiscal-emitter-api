import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { JwtAdminGuard } from './jwt-admin.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: { expiresIn: '8h', issuer: 'fiscal-emitter-api' },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers:   [AdminAuthService, JwtAdminGuard],
  exports:     [JwtAdminGuard, JwtModule],
})
export class AdminAuthModule {}

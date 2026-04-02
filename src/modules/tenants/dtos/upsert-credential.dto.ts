import {
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertCredentialDto {
  @ApiProperty({ enum: ['sandbox', 'production'] })
  @IsEnum(['sandbox', 'production'])
  environment: 'sandbox' | 'production';

  /**
   * Certificado PFX/P12 codificado em Base64.
   * Decodificado e armazenado como BLOB no banco.
   */
  @ApiPropertyOptional({ description: 'Certificado A1 (PFX) em Base64' })
  @IsOptional()
  @IsString()
  certificatePfxBase64?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificatePassword?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  certificateExpiresAt?: string;

  /**
   * Configurações extras: clientId, clientSecret OAuth, ibgeCode do município, etc.
   * Exemplo: { "clientId": "xxx", "clientSecret": "yyy", "ibgeCode": "3550308" }
   */
  @ApiPropertyOptional({
    description: 'Config OAuth e dados do município',
    example: { clientId: 'xxx', clientSecret: 'yyy', ibgeCode: '3550308' },
  })
  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, any>;
}

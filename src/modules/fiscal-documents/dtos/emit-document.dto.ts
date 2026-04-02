import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TakerAddressDto {
  @ApiPropertyOptional({ example: 'Rua das Flores' })
  @IsOptional() @IsString() street?: string;

  @ApiPropertyOptional({ example: '123' })
  @IsOptional() @IsString() number?: string;

  @ApiPropertyOptional({ example: 'Sala 4' })
  @IsOptional() @IsString() complement?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional() @IsString() district?: string;

  @ApiPropertyOptional({ example: '3550308', description: 'Código IBGE 7 dígitos' })
  @IsOptional() @IsString() @Length(7, 7) cityCode?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional() @IsString() cityName?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional() @IsString() @Length(2, 2) state?: string;

  @ApiPropertyOptional({ example: '01001000', description: '8 dígitos sem traço' })
  @IsOptional() @IsString() @Matches(/^\d{8}$/) zipCode?: string;
}

export class TakerDto {
  @ApiProperty({ enum: ['cpf', 'cnpj'] })
  @IsEnum(['cpf', 'cnpj']) documentType: 'cpf' | 'cnpj';

  @ApiProperty({ example: '12345678901', description: '11 dígitos (CPF) ou 14 (CNPJ), sem máscara' })
  @IsString() @IsNotEmpty()
  @Matches(/^\d{11,14}$/) document: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsString() @IsNotEmpty() name: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ type: TakerAddressDto })
  @IsOptional() @ValidateNested() @Type(() => TakerAddressDto) address?: TakerAddressDto;
}

export class TaxesDto {
  @ApiPropertyOptional({ example: 0.05, description: 'Alíquota ISS (0.05 = 5%)' })
  @IsOptional() @IsNumber() @Min(0) issRate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsNumber() @Min(0) deductions?: number;

  @ApiPropertyOptional({ example: 9.75 })
  @IsOptional() @IsNumber() @Min(0) pisAmount?: number;

  @ApiPropertyOptional({ example: 45.00 })
  @IsOptional() @IsNumber() @Min(0) cofinsAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsNumber() @Min(0) irAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsNumber() @Min(0) csllAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @IsNumber() @Min(0) inssAmount?: number;
}

export class ServiceDto {
  @ApiProperty({ example: '17.06', description: 'Código LC 116/2003' })
  @IsString() @IsNotEmpty() code: string;

  @ApiProperty({ example: 'Consultoria em tecnologia da informação' })
  @IsString() @IsNotEmpty() description: string;

  @ApiProperty({ example: 1500.00, description: 'Valor bruto do serviço' })
  @IsNumber() @IsPositive() amount: number;

  @ApiPropertyOptional({ type: TaxesDto })
  @IsOptional() @ValidateNested() @Type(() => TaxesDto) taxes?: TaxesDto;
}

export class RpsDto {
  @ApiPropertyOptional({ example: '1001' })
  @IsOptional() @IsString() number?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional() @IsString() series?: string;

  @ApiPropertyOptional({ example: 'RPS', default: 'RPS' })
  @IsOptional() @IsString() type?: string;
}

export class EmitDocumentDto {
  @ApiProperty({
    example: 'PEDIDO-2024-001',
    description: 'Identificador único no sistema do cliente. Chave de idempotência.',
  })
  @IsString() @IsNotEmpty() externalReference: string;

  @ApiProperty({ enum: ['sandbox', 'production'], default: 'sandbox' })
  @IsEnum(['sandbox', 'production']) environment: 'sandbox' | 'production' = 'sandbox';

  @ApiProperty({ example: '12345678000195', description: 'CNPJ do prestador (14 dígitos)' })
  @IsString() @IsNotEmpty() @Matches(/^\d{14}$/) providerCnpj: string;

  @ApiProperty({ example: 'Empresa Demo Ltda' })
  @IsString() @IsNotEmpty() providerName: string;

  @ApiProperty({ type: TakerDto })
  @ValidateNested() @Type(() => TakerDto) taker: TakerDto;

  @ApiProperty({ type: ServiceDto })
  @ValidateNested() @Type(() => ServiceDto) service: ServiceDto;

  @ApiPropertyOptional({ type: RpsDto })
  @IsOptional() @ValidateNested() @Type(() => RpsDto) rps?: RpsDto;
}

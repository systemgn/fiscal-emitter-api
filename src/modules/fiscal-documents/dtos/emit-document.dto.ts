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

export class TakerAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  @Length(7, 7, { message: 'cityCode must be 7 digits (IBGE)' })
  cityCode?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'zipCode must be 8 digits' })
  zipCode?: string;
}

export class TakerDto {
  @IsEnum(['cpf', 'cnpj'])
  documentType: 'cpf' | 'cnpj';

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11,14}$/, { message: 'document must be 11 (CPF) or 14 (CNPJ) digits' })
  document: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TakerAddressDto)
  address?: TakerAddressDto;
}

export class TaxesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  issRate?: number;   // alíquota ISS (ex: 0.05 = 5%)

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pisAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cofinsAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  irAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  csllAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inssAmount?: number;
}

export class ServiceDto {
  @IsString()
  @IsNotEmpty()
  code: string;   // código LC 116/2003

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaxesDto)
  taxes?: TaxesDto;
}

export class RpsDto {
  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class EmitDocumentDto {
  /**
   * Identificador único do documento no sistema do cliente.
   * Usado como chave de idempotência (junto ao tenantId e payload hash).
   */
  @IsString()
  @IsNotEmpty()
  externalReference: string;

  @IsEnum(['sandbox', 'production'])
  environment: 'sandbox' | 'production' = 'sandbox';

  /** CNPJ do prestador de serviços */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{14}$/, { message: 'providerCnpj must be 14 digits' })
  providerCnpj: string;

  @IsString()
  @IsNotEmpty()
  providerName: string;

  @ValidateNested()
  @Type(() => TakerDto)
  taker: TakerDto;

  @ValidateNested()
  @Type(() => ServiceDto)
  service: ServiceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RpsDto)
  rps?: RpsDto;
}

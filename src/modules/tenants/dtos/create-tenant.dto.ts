import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{14}$/, { message: 'document must be 14 digits (CNPJ without mask)' })
  document: string;

  @IsEmail()
  email: string;
}

export class CreateApiClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

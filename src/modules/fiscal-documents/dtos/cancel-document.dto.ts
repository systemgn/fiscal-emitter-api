import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

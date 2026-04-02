import { IsEnum } from 'class-validator';

export class ExportDocumentDto {
  @IsEnum(['xml', 'pdf'])
  type: 'xml' | 'pdf' = 'xml';
}

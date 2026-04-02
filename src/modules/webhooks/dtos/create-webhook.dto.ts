import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { WebhookEvent } from '../entities/webhook-subscription.entity';

const VALID_EVENTS: WebhookEvent[] = [
  'document.issued',
  'document.rejected',
  'document.cancelled',
  'document.error',
  'export.ready',
];

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUrl({ require_tld: false }, { message: 'url must be a valid URL' })
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(VALID_EVENTS, { each: true })
  events: WebhookEvent[];
}

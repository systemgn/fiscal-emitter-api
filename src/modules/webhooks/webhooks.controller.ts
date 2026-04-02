import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dtos/create-webhook.dto';

@UseGuards(ApiKeyGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  /** POST /v1/webhooks — cria subscription */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentTenant() tenant: Tenant, @Body() dto: CreateWebhookDto) {
    return this.svc.create(tenant.id, dto);
  }

  /** GET /v1/webhooks — lista subscriptions do tenant */
  @Get()
  findAll(@CurrentTenant() tenant: Tenant) {
    return this.svc.findAll(tenant.id);
  }

  /** GET /v1/webhooks/:id */
  @Get(':id')
  findOne(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.findOne(tenant.id, id);
  }

  /** PATCH /v1/webhooks/:id/toggle — ativa/inativa */
  @Patch(':id/toggle')
  toggle(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.toggleStatus(tenant.id, id);
  }

  /** DELETE /v1/webhooks/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.remove(tenant.id, id);
  }
}

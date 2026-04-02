import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { EmitDocumentDto } from './dtos/emit-document.dto';
import { CancelDocumentDto } from './dtos/cancel-document.dto';
import { ExportDocumentDto } from './dtos/export-document.dto';

@ApiTags('Documents')
@ApiSecurity('api-key')
@ApiSecurity('api-secret')
@ApiUnauthorizedResponse({ description: 'Credenciais inválidas ou ausentes' })
@UseGuards(ApiKeyGuard)
@Controller('documents')
export class FiscalDocumentsController {
  constructor(private readonly svc: FiscalDocumentsService) {}

  @Post('emit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicitar emissão de NFS-e',
    description:
      'Idempotente por `externalReference`. Retorna o documento existente se já submetido com o mesmo payload.',
  })
  @ApiAcceptedResponse({ description: 'Documento aceito para processamento (status: pending)' })
  emit(@CurrentTenant() tenant: Tenant, @Body() dto: EmitDocumentDto) {
    return this.svc.emit(tenant, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar documento por ID interno' })
  @ApiOkResponse({ description: 'Documento encontrado' })
  @ApiNotFoundResponse({ description: 'Documento não encontrado' })
  findById(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.findById(tenant.id, id);
  }

  @Get('by-external-reference/:externalReference')
  @ApiOperation({ summary: 'Consultar documento por externalReference' })
  @ApiOkResponse({ description: 'Documento encontrado' })
  @ApiNotFoundResponse({ description: 'Nenhum documento com essa referência' })
  findByExternalReference(
    @CurrentTenant() tenant: Tenant,
    @Param('externalReference') ref: string,
  ) {
    return this.svc.findByExternalReference(tenant.id, ref);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicitar cancelamento de NFS-e',
    description: 'Apenas documentos com status `issued` podem ser cancelados.',
  })
  @ApiAcceptedResponse({ description: 'Cancelamento aceito (status: processing)' })
  cancel(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    return this.svc.cancel(tenant, id, dto);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Histórico de eventos do documento' })
  @ApiOkResponse({ description: 'Lista de eventos em ordem cronológica' })
  getEvents(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.getEvents(tenant.id, id);
  }

  @Post(':id/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicitar exportação de XML ou PDF',
    description:
      'Retorna `exportLogId`. Use `GET /v1/exports/:exportLogId` para acompanhar o status e obter a URL de download.',
  })
  @ApiAcceptedResponse({ description: 'Exportação enfileirada' })
  requestExport(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
    @Body() dto: ExportDocumentDto,
  ) {
    return this.svc.requestExport(tenant, id, dto);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Retentar emissão de documento com erro',
    description:
      'Recoloca na fila documentos com status `error`. Útil quando a falha foi temporária (ex: SEFAZ indisponível).',
  })
  @ApiAcceptedResponse({ description: 'Documento recolocado na fila' })
  retry(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.svc.retry(tenant, id);
  }
}

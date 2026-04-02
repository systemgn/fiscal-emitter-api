import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Fiscal Emitter API')
    .setDescription(
      `## NFS-e Nacional — Emissor Multi-tenant via API

### Autenticação
Todas as rotas (exceto \`/health\` e \`/metrics\`) exigem os headers:
- \`x-api-key\`: chave gerada via \`POST /v1/admin/tenants/:id/api-clients\`
- \`x-api-secret\`: secret retornado **uma única vez** na criação do client

### Fluxo de emissão
\`\`\`
POST /v1/documents/emit  → status: pending
         ↓ (BullMQ processa)
     status: processing
         ↓ (SEFAZ responde)
     status: issued | rejected
         ↓ (webhook disparado)
     document.issued | document.rejected
\`\`\`

### Idempotência
Enviar a mesma \`externalReference\` com o mesmo payload retorna o documento existente (HTTP 202), sem criar duplicata.
      `,
    )
    .setVersion('3.0.0')
    .setContact('Suporte', '', 'suporte@fiscalemitter.com.br')
    .addServer('http://localhost:3000', 'Local')
    .addServer('https://fiscal-emitter-api.up.railway.app', 'Produção')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-secret' }, 'api-secret')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-admin-key' }, 'admin-key')
    .addTag('Documents', 'Emissão, consulta, cancelamento e exportação de NFS-e')
    .addTag('Webhooks', 'Gerenciamento de subscriptions de eventos')
    .addTag('Exports', 'Polling de status de exportação XML/PDF')
    .addTag('Admin — Tenants', 'Gestão de tenants (requer x-admin-key)')
    .addTag('Admin — Credentials', 'Certificados digitais e OAuth por tenant')
    .addTag('Health', 'Healthcheck da API e banco de dados')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Fiscal Emitter API — Docs',
  });
}

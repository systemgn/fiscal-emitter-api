# CLAUDE.md — Contexto do Projeto: Fiscal Emitter API

> **Instrução para toda IA que atuar neste projeto:**
> Este arquivo é a fonte de verdade do projeto. Leia-o integralmente antes de qualquer ação.
> **Sempre que uma alteração for feita no projeto — seja em tecnologia, configuração, regras de negócio, estrutura de arquivos ou qualquer outro aspecto — atualize imediatamente a seção correspondente deste documento.**
> O objetivo é que este arquivo reflita sempre o estado atual real do projeto. Informações desatualizadas são piores que nenhuma informação.

---

## 1. Visão Geral

**Fiscal Emitter API** é um microserviço SaaS multi-tenant para emissão de NFS-e (Nota Fiscal de Serviço Eletrônica) via a plataforma NFS-e Nacional (SEFAZ). Totalmente desacoplado de ERPs, expõe uma API REST simples para que sistemas terceiros integrem emissão fiscal sem conhecer os detalhes do protocolo SEFAZ.

**Produto:** API de emissão fiscal como serviço. Clientes são empresas (tenants) que integram via API Key + Secret.

**Repositório GitHub:** `https://github.com/systemgn/fiscal-emitter-api`

**Principais características:**
- Multi-tenant com isolamento total de dados por `tenant_id`
- Processamento **assíncrono** via filas BullMQ (cliente recebe 202 imediatamente)
- **Idempotência** garantida — mesmo `externalReference` nunca gera documento duplicado
- **Retry automático** com backoff exponencial para erros técnicos da SEFAZ
- **Webhooks** com assinatura HMAC-SHA256 para notificar eventos
- Autenticação em camadas: API Key+Secret (tenants) e JWT Bearer (admin)
- Observabilidade completa: logs Pino (JSON), métricas Prometheus, Bull Board

---

## 2. Stack de Tecnologias

| Camada           | Tecnologia              | Versão   | Observações                                              |
|------------------|-------------------------|----------|----------------------------------------------------------|
| Runtime          | Node.js                 | 20.x     | Docker: node:20-alpine                                   |
| Framework        | NestJS                  | ^10.3.0  | TypeScript, modular, DI nativo                           |
| Linguagem        | TypeScript              | ^5.3.3   | Strict mode                                              |
| Banco            | MySQL                   | 8.0      | InnoDB, utf8mb4, Railway em produção                     |
| ORM              | TypeORM                 | ^0.3.20  | Entities, Repository pattern                             |
| Filas            | BullMQ                  | ^5.4.2   | 4 filas: emit, cancel, export, webhook.dispatch          |
| Cache/Fila       | Redis                   | 7-alpine | Backend do BullMQ                                        |
| Redis client     | ioredis                 | ^5.3.2   |                                                          |
| Auth (tenant)    | API Key + bcrypt        | —        | x-api-key + x-api-secret headers                         |
| Auth (admin)     | @nestjs/jwt             | ^10.2.0  | Bearer JWT com role=admin                                |
| Hash de senhas   | bcrypt                  | ^5.1.1   | Salt rounds = 10                                         |
| Certificados     | node-forge              | ^1.3.1   | Leitura e validação de PFX/P12 (certificado A1)          |
| HTTP client      | axios                   | ^1.6.8   | Chamadas mTLS para SEFAZ                                 |
| Logging          | nestjs-pino + pino-http | ^4.1.0   | JSON em produção, pino-pretty em dev                     |
| Métricas         | prom-client             | ^15.1.2  | Prometheus, GET /metrics                                 |
| Documentação     | @nestjs/swagger         | ^7.3.0   | Swagger UI em GET /v1/docs                               |
| Rate limiting    | @nestjs/throttler       | ^5.1.2   | 120 req/min por tenant                                   |
| Health check     | @nestjs/terminus        | ^10.2.3  | GET /v1/health                                           |
| Painel de filas  | @bull-board             | ^5.19.0  | GET /admin/queues (Basic Auth)                           |
| Validação        | class-validator         | ^0.14.1  | Decorators em DTOs                                       |
| Transformação    | class-transformer       | ^0.5.1   | Serialização/deserialização                              |
| UUID             | uuid                    | ^9.0.1   | Geração de IDs v4                                        |
| Deploy           | Railway                 | —        | Docker build, startCommand = `sh start.sh`               |

---

## 3. Estrutura de Arquivos

```
fiscal-emitter-api/
├── CLAUDE.md
├── .env                              ← credenciais e segredos (nunca commitar)
├── .env.example                      ← template de variáveis
├── package.json                      ← scripts: start:dev, start:worker, build, db:migrate:v2, db:migrate:v3
├── tsconfig.json
├── Dockerfile                        ← multi-stage: builder (npm build) + runtime (node:20-alpine)
├── docker-compose.yml                ← MySQL 8 + Redis 7 + API + Worker para desenvolvimento local
├── start.sh                          ← Railway: inicia Worker em background + API em foreground
├── railway.toml                      ← builder=DOCKERFILE, healthcheckPath=/v1/health, timeout=120s
├── src/
│   ├── main.ts                       ← entry point da API; global prefix v1; Swagger + Bull Board no startup
│   ├── app.module.ts                 ← módulo raiz; registra todos os módulos, ThrottlerModule, LoggerModule
│   ├── config/
│   │   └── app.config.ts             ← mapeamento de process.env para objeto tipado
│   ├── common/
│   │   ├── decorators/
│   │   │   └── current-tenant.decorator.ts   ← @CurrentTenant() extrai req.tenant
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts      ← formata erros no padrão ApiResponse
│   │   ├── guards/
│   │   │   └── tenant-throttle.guard.ts      ← rate limiter por tenant_id
│   │   └── interceptors/
│   │       └── response.interceptor.ts       ← envolve toda resposta em { success, data, error, meta }
│   ├── infrastructure/
│   │   ├── bull-board/
│   │   │   └── bull-board.setup.ts           ← monta painel em /admin/queues com Basic Auth
│   │   ├── logger/
│   │   │   └── pino.config.ts                ← pinoConfig() com customProps (tenantId, requestId)
│   │   ├── metrics/
│   │   │   ├── metrics.controller.ts         ← GET /metrics (fora do prefix v1)
│   │   │   ├── metrics.module.ts
│   │   │   └── metrics.service.ts            ← counters, histogramas, gauges Prometheus
│   │   ├── queue/
│   │   │   ├── emission.producer.ts          ← enqueueEmission(), enqueueCancel(), enqueueExport()
│   │   │   └── queue.config.ts               ← constantes QUEUE_EMIT/CANCEL/EXPORT + interfaces de job data
│   │   └── swagger/
│   │       └── swagger.setup.ts              ← DocumentBuilder com todas as tags e esquemas de segurança
│   ├── modules/
│   │   ├── admin-auth/
│   │   │   ├── admin-auth.controller.ts      ← POST /v1/admin/auth/login
│   │   │   ├── admin-auth.service.ts         ← valida ADMIN_USERNAME + ADMIN_PASSWORD_HASH (bcrypt)
│   │   │   ├── admin-auth.module.ts          ← JwtModule.registerAsync com JWT_SECRET
│   │   │   └── jwt-admin.guard.ts            ← valida Bearer token com role=admin
│   │   ├── auth/
│   │   │   ├── auth.service.ts               ← validateApiCredentials(); bcrypt.compare do secret
│   │   │   ├── auth.module.ts
│   │   │   └── guards/
│   │   │       └── api-key.guard.ts          ← lê x-api-key + x-api-secret, popula req.tenant
│   │   ├── exports/
│   │   │   ├── exports.controller.ts         ← GET /v1/exports/:id
│   │   │   └── exports.module.ts
│   │   ├── fiscal-documents/
│   │   │   ├── entities/
│   │   │   │   ├── fiscal-document.entity.ts
│   │   │   │   └── fiscal-document-event.entity.ts
│   │   │   ├── dtos/
│   │   │   │   ├── emit-document.dto.ts
│   │   │   │   ├── cancel-document.dto.ts
│   │   │   │   └── export-document.dto.ts
│   │   │   ├── fiscal-documents.controller.ts
│   │   │   ├── fiscal-documents.service.ts   ← FiscalExportLog definido e exportado aqui (inline entity); registrado no forFeature do módulo
│   │   │   ├── fiscal-documents.module.ts
│   │   │   ├── fiscal-documents.service.spec.ts
│   │   │   └── fiscal-documents.service.spec.ts
│   │   ├── health/
│   │   │   ├── health.controller.ts          ← GET /v1/health
│   │   │   └── health.module.ts
│   │   ├── providers/
│   │   │   ├── fiscal-provider.interface.ts  ← interfaces FiscalProvider, EmitPayload, EmitResult, etc.
│   │   │   ├── mock/
│   │   │   │   └── mock-fiscal.provider.ts   ← 10% chance de falha aleatória (sandbox/testes)
│   │   │   ├── nfse-nacional/
│   │   │   │   ├── nfse-nacional.provider.ts ← implementação real: mTLS + OAuth + SEFAZ REST
│   │   │   │   └── nfse-error-codes.ts       ← 28 códigos SEFAZ; classifyNfseError() + shouldRetry()
│   │   │   └── providers.module.ts           ← injeta NfseNacionalProvider como FISCAL_PROVIDER
│   │   ├── tenants/
│   │   │   ├── entities/
│   │   │   │   ├── tenant.entity.ts
│   │   │   │   ├── api-client.entity.ts
│   │   │   │   └── tenant-credential.entity.ts
│   │   │   ├── dtos/
│   │   │   │   └── upsert-credential.dto.ts
│   │   │   ├── tenants.controller.ts         ← CRUD de tenants + API clients (requer JWT admin)
│   │   │   ├── tenants.service.ts
│   │   │   ├── tenants.module.ts             ← importa AdminAuthModule para resolver JwtAdminGuard
│   │   │   ├── credentials.controller.ts     ← POST/GET /v1/admin/tenants/:id/credentials
│   │   │   └── credentials.service.ts        ← valida e armazena PFX; mascara cert/password no retorno
│   │   └── webhooks/
│   │       ├── entities/
│   │       │   ├── webhook-subscription.entity.ts  ← events como JSON array
│   │       │   └── webhook-delivery.entity.ts
│   │       ├── dtos/
│   │       │   └── create-webhook.dto.ts
│   │       ├── webhooks.controller.ts        ← CRUD de subscriptions + toggle
│   │       ├── webhooks.service.ts           ← dispatch() enfileira; deliver() faz HTTP POST com HMAC
│   │       └── webhooks.module.ts
│   └── worker/
│       ├── worker-entry.ts                   ← entry point do worker (NestFactory.createApplicationContext)
│       ├── worker.module.ts                  ← módulo standalone para o Worker
│       └── processors/
│           ├── emission.processor.ts         ← @Processor(QUEUE_EMIT); chama provider.emit(); dispara webhook
│           ├── cancellation.processor.ts     ← @Processor(QUEUE_CANCEL); chama provider.cancel(); dispara webhook
│           ├── export.processor.ts           ← @Processor(QUEUE_EXPORT); chama provider.export(); importa FiscalExportLog do service
│           └── webhook.processor.ts          ← @Processor(QUEUE_WEBHOOK); entrega via webhooksService.deliver()
├── database/
│   ├── schema.sql                            ← schema inicial (8 tabelas + seed)
│   └── migrations/
│       ├── v2.sql                            ← webhook_subscriptions, webhook_deliveries, rate_limit_hits
│       └── v3.sql                            ← admin_login_log, índice em api_key_status
└── test/
    └── documents.e2e-spec.ts
```

---

## 4. Configuração do Ambiente (`.env`)

```env
# ── Aplicação ──────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
API_PREFIX=v1

# ── Banco de Dados ─────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=secret
DB_NAME=fiscal_emitter

# ── Redis (BullMQ) ─────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=              # opcional

# ── Filas BullMQ ───────────────────────────────────────────────────
QUEUE_EMIT_CONCURRENCY=5
QUEUE_CANCEL_CONCURRENCY=3
QUEUE_EXPORT_CONCURRENCY=2
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=5000     # ms — delay inicial do backoff exponencial

# ── SEFAZ NFS-e Nacional ───────────────────────────────────────────
NFSE_NACIONAL_SANDBOX_URL=https://sandbox.nfse.gov.br
NFSE_NACIONAL_PRODUCTION_URL=https://nfse.gov.br

# ── Segurança ──────────────────────────────────────────────────────
BCRYPT_ROUNDS=10
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=         # gerar: node -e "require('bcrypt').hash('senha',10).then(console.log)"
JWT_SECRET=                  # string aleatória longa (mín. 32 chars)

# ── Bull Board ─────────────────────────────────────────────────────
BULL_BOARD_USER=admin
BULL_BOARD_PASS=changeme     # trocar em produção

# ── Swagger ────────────────────────────────────────────────────────
SWAGGER_ENABLED=true         # false em produção se preferir

# ── Logging ────────────────────────────────────────────────────────
LOG_LEVEL=debug              # info em produção
```

---

## 5. Banco de Dados

**Banco:** `fiscal_emitter` (charset `utf8mb4`, collation `utf8mb4_unicode_ci`, engine `InnoDB`)

### `tenants`
| Coluna     | Tipo         | Observações                                       |
|------------|--------------|---------------------------------------------------|
| id         | CHAR(36) PK  | UUID v4                                           |
| name       | VARCHAR(255) | Razão social da empresa                           |
| document   | VARCHAR(14) UNIQUE | CNPJ sem máscara (14 dígitos)               |
| email      | VARCHAR(191) UNIQUE |                                             |
| status     | ENUM         | `active` / `inactive` / `suspended`               |
| created_at | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                         |
| updated_at | TIMESTAMP    | ON UPDATE CURRENT_TIMESTAMP                       |

### `api_clients`
| Coluna          | Tipo         | Observações                                       |
|-----------------|--------------|---------------------------------------------------|
| id              | CHAR(36) PK  |                                                   |
| tenant_id       | CHAR(36) FK  | ON DELETE CASCADE                                 |
| name            | VARCHAR(255) | Label descritivo (ex: "Integração Sandbox")       |
| api_key         | VARCHAR(64) UNIQUE | Prefixo `fea_` + bytes aleatórios           |
| api_secret_hash | VARCHAR(255) | bcrypt do secret — **nunca retornar o hash**      |
| status          | ENUM         | `active` / `inactive`                             |
| last_used_at    | TIMESTAMP NULL | Atualizado a cada request autenticado            |

### `tenant_credentials`
| Coluna                | Tipo          | Observações                                    |
|-----------------------|---------------|------------------------------------------------|
| id                    | CHAR(36) PK   |                                                |
| tenant_id             | CHAR(36) FK   | ON DELETE CASCADE                              |
| environment           | ENUM          | `sandbox` / `production` — UNIQUE com tenant_id|
| certificate_pfx       | LONGBLOB NULL | Arquivo .pfx/.p12 completo em bytes            |
| certificate_password  | VARCHAR(255) NULL | Senha para desencriptar o PFX              |
| certificate_expires_at | DATE NULL    | Extraído do certificado pelo node-forge        |
| access_token          | TEXT NULL     | Bearer token OAuth obtido da SEFAZ             |
| token_expires_at      | TIMESTAMP NULL | Expiração do token — revalidado automaticamente|
| extra_config          | JSON NULL     | Campos livres (ex: `clientId`, `ibgeCode`)     |

### `fiscal_documents`
| Coluna                | Tipo            | Observações                                  |
|-----------------------|-----------------|----------------------------------------------|
| id                    | CHAR(36) PK     |                                              |
| tenant_id             | CHAR(36) FK     |                                              |
| external_reference    | VARCHAR(255)    | ID do cliente; UNIQUE por tenant             |
| idempotency_key       | VARCHAR(64)     | SHA256(tenant+extRef+payload); UNIQUE por tenant |
| status                | ENUM            | `pending` / `processing` / `issued` / `cancelled` / `error` / `rejected` |
| environment           | ENUM            | `sandbox` / `production`                     |
| provider_cnpj         | VARCHAR(14)     | CNPJ do prestador de serviços                |
| provider_name         | VARCHAR(255)    |                                              |
| taker_document_type   | ENUM            | `cpf` / `cnpj`                               |
| taker_document        | VARCHAR(14)     | CPF ou CNPJ do tomador (sem máscara)         |
| taker_name            | VARCHAR(255)    |                                              |
| taker_email           | VARCHAR(191) NULL |                                            |
| taker_street/number/complement/district | VARCHAR NULL | Endereço do tomador             |
| taker_city_code       | VARCHAR(10) NULL | Código IBGE (7 dígitos)                     |
| taker_city_name       | VARCHAR(100) NULL |                                            |
| taker_state           | CHAR(2) NULL    | UF                                           |
| taker_zip_code        | VARCHAR(8) NULL |                                              |
| service_code          | VARCHAR(20)     | Código LC 116/2003                           |
| service_description   | TEXT            |                                              |
| service_amount        | DECIMAL(15,2)   | Valor bruto do serviço                       |
| deductions            | DECIMAL(15,2)   | DEFAULT 0                                    |
| iss_rate              | DECIMAL(7,4)    | Alíquota ISS (ex: 0.0500 = 5%)              |
| iss_amount            | DECIMAL(15,2)   |                                              |
| pis_amount / cofins_amount / ir_amount / csll_amount / inss_amount | DECIMAL(15,2) | Tributos |
| net_amount            | DECIMAL(15,2)   | Valor líquido = amount - deductions - tributos |
| nfse_number           | VARCHAR(50) NULL | Número da NFS-e emitida pela SEFAZ          |
| nfse_code             | VARCHAR(50) NULL | Código de verificação                        |
| nfse_issued_at        | TIMESTAMP NULL  |                                              |
| nfse_rps_number/series/type | VARCHAR NULL | Dados do RPS                            |
| cancel_reason         | VARCHAR(255) NULL |                                            |
| cancel_requested_at / cancelled_at | TIMESTAMP NULL |                              |
| error_code            | VARCHAR(50) NULL |                                             |
| error_message         | TEXT NULL       |                                              |
| retry_count           | INT             | DEFAULT 0 — incrementado a cada retry        |
| raw_response          | JSON NULL       | Última resposta completa da SEFAZ            |

> **Índices relevantes:** UNIQUE (tenant_id, idempotency_key) · UNIQUE (tenant_id, external_reference) · UNIQUE (tenant_id, nfse_number) · KEY (tenant_id, status) · KEY (tenant_id, environment, status)

### `fiscal_document_events`
| Coluna     | Tipo           | Observações                                         |
|------------|----------------|-----------------------------------------------------|
| id         | BIGINT PK AI   |                                                     |
| document_id | CHAR(36) FK   | ON DELETE CASCADE                                   |
| tenant_id  | CHAR(36)       |                                                     |
| event_type | VARCHAR(60)    | `emission_requested` / `processing` / `issued` / `error` / `cancelled` / `export_requested` / `retry` / `webhook_dispatched` |
| status_from | VARCHAR(30) NULL |                                                  |
| status_to  | VARCHAR(30) NULL |                                                   |
| message    | TEXT NULL      |                                                     |
| metadata   | JSON NULL      | Dados extras do evento                              |
| created_at | TIMESTAMP      |                                                     |

### `webhook_subscriptions`
| Coluna     | Tipo         | Observações                                           |
|------------|--------------|-------------------------------------------------------|
| id         | CHAR(36) PK  |                                                       |
| tenant_id  | CHAR(36) FK  | ON DELETE CASCADE                                     |
| name       | VARCHAR(100) | Label descritivo                                      |
| url        | VARCHAR(500) | Endpoint que receberá os POSTs                        |
| secret     | VARCHAR(64)  | Chave HMAC-SHA256 — retornada apenas na criação       |
| events     | JSON         | Ex: `["document.issued","document.cancelled"]`        |
| status     | ENUM         | `active` / `inactive`                                 |

### `webhook_deliveries`
| Coluna          | Tipo         | Observações                                     |
|-----------------|--------------|-------------------------------------------------|
| id              | CHAR(36) PK  |                                                 |
| subscription_id | CHAR(36) FK  | ON DELETE CASCADE                               |
| document_id     | CHAR(36)     |                                                 |
| tenant_id       | CHAR(36)     |                                                 |
| event_type      | VARCHAR(60)  |                                                 |
| payload         | JSON         | Corpo exato enviado ao endpoint                 |
| status          | ENUM         | `pending` / `delivered` / `failed`              |
| http_status     | INT NULL     | HTTP status da resposta do endpoint             |
| response_body   | TEXT NULL    |                                                 |
| attempts        | INT          | DEFAULT 0                                       |
| last_attempt_at | TIMESTAMP NULL |                                               |

### `fiscal_exports_log`
| Coluna         | Tipo         | Observações                                        |
|----------------|--------------|----------------------------------------------------|
| id             | CHAR(36) PK  |                                                    |
| document_id    | CHAR(36) FK  |                                                    |
| tenant_id      | CHAR(36)     |                                                    |
| export_type    | ENUM         | `xml` / `pdf`                                      |
| status         | ENUM         | `pending` / `processing` / `ready` / `expired` / `error` |
| download_url   | TEXT NULL    | URL temporária (presigned S3 ou SEFAZ)             |
| url_expires_at | TIMESTAMP NULL |                                                  |
| error_message  | TEXT NULL    |                                                    |

> **Nota:** `FiscalExportLog` está definido como classe **inline** em `fiscal-documents.service.ts` (não em `/entities/`) e precisa ser importado de lá via `import { FiscalExportLog } from './fiscal-documents.service'`. A entity é registrada no `TypeOrmModule.forFeature()` do `FiscalDocumentsModule` e do `WorkerModule`, e na lista de `entities` do `AppModule` e `WorkerModule`.

### `fiscal_requests` (log de chamadas SEFAZ)
| Coluna           | Tipo         | Observações                                   |
|------------------|--------------|-----------------------------------------------|
| id               | BIGINT PK AI |                                               |
| document_id      | CHAR(36) NULL |                                              |
| tenant_id        | CHAR(36)     |                                               |
| operation        | VARCHAR(50)  | `emit` / `cancel` / `status` / `export`       |
| provider         | VARCHAR(50)  | DEFAULT `nfse_nacional`                       |
| http_method      | VARCHAR(10) NULL |                                           |
| endpoint         | VARCHAR(500) NULL |                                          |
| request_payload  | JSON NULL    |                                               |
| response_status  | INT NULL     |                                               |
| response_body    | JSON NULL    |                                               |
| duration_ms      | INT NULL     |                                               |
| success          | TINYINT(1)   | DEFAULT 0                                     |
| error_message    | TEXT NULL    |                                               |

### `fiscal_jobs` (controle de jobs BullMQ)
| Coluna        | Tipo         | Observações                                          |
|---------------|--------------|------------------------------------------------------|
| id            | CHAR(36) PK  |                                                      |
| document_id   | CHAR(36) FK  |                                                      |
| job_type      | ENUM         | `emit` / `cancel` / `export` / `retry`               |
| bullmq_job_id | VARCHAR(255) NULL |                                                 |
| status        | ENUM         | `queued` / `active` / `completed` / `failed` / `delayed` |
| attempts      | INT          |                                                      |
| max_attempts  | INT          | DEFAULT 3                                            |
| next_retry_at | TIMESTAMP NULL |                                                   |

---

## 6. Regras de Negócio

### Multi-Tenancy e Isolamento
- Todo dado no banco tem `tenant_id` — todas as queries DEVEM incluir `WHERE tenant_id = ?`
- Um tenant pode ter múltiplos `api_clients` (diferentes integrações)
- Rate limiting: **120 req/min por tenant** via `TenantThrottleGuard`
- Tenant `inactive` ou `suspended` → todas as requests bloqueadas com 401

### Autenticação em Camadas
- **Tenants (operações fiscais):** headers `x-api-key` + `x-api-secret` → `ApiKeyGuard` → bcrypt.compare → popula `req.tenant`
- **Admin (gestão de tenants):** `POST /v1/admin/auth/login` com `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` → retorna JWT Bearer → `JwtAdminGuard` verifica `role=admin`
- **API Secret:** retornado **uma única vez** ao criar o `api_client` — não é possível recuperar depois. Salvo apenas como hash bcrypt.
- **Geração de API Key:** prefixo `fea_` + `randomBytes(24).hex()` — prefixo facilita identificação em logs/scanning

### Idempotência
- Calculada via `SHA256(tenantId + "|" + externalReference + "|" + JSON.stringify(dto))`
- UNIQUE constraint `(tenant_id, idempotency_key)` no banco garante sem race condition
- Se documento já existe com mesma `externalReference`, retorna o existente sem criar novo job
- `externalReference` é o ID do documento no sistema do cliente

### Ciclo de Vida do Documento e Transições de Status
```
Transições válidas:
  pending     → processing   (job iniciado pelo worker)
  processing  → issued       (SEFAZ aceitou a NFS-e)
  processing  → rejected     (SEFAZ rejeitou por erro de negócio — sem retry)
  processing  → error        (erro técnico — aguarda retry)
  error       → processing   (retry agendado)
  issued      → processing   (cancelamento solicitado)
  processing  → cancelled    (cancelamento confirmado pela SEFAZ)
```

### Retry com Backoff Exponencial
- **Erros técnicos** (timeout, rede, 5xx SEFAZ) → relança exceção no processor → BullMQ agenda retry automaticamente
- **Erros de negócio** (CNPJ inválido, código de serviço errado, etc.) → `classifyNfseError()` retorna `BUSINESS` → status `rejected`, sem retry
- Backoff: `delay * 5^(tentativa-1)` — tentativa 1: 5s, tentativa 2: 25s, tentativa 3: dead-letter
- `QUEUE_MAX_ATTEMPTS=3` configurável via ENV
- Jobs falhados ficam no Redis com `removeOnFail: false` — visíveis no Bull Board

### Webhook
- Ao mudar status do documento, o processor chama `webhooksService.dispatch(eventType, document)`
- `dispatch()` busca subscriptions ativas do tenant que escutam o evento e enfileira uma `webhook_delivery` para cada
- `deliver()` faz HTTP POST ao endpoint com header `X-Webhook-Signature = HMAC-SHA256(JSON.stringify(payload), secret)`
- Cliente valida recriando o HMAC com seu `secret` e comparando com o header
- Eventos suportados: `document.issued` · `document.rejected` · `document.cancelled` · `document.error` · `export.ready`
- Retry de webhooks: até `QUEUE_MAX_ATTEMPTS` tentativas com backoff

### Certificado Digital A1 (mTLS)
- Tenant faz upload do PFX (base64) via `POST /v1/admin/tenants/:id/credentials`
- `credentials.service.ts` valida o PFX com node-forge (`forge.pkcs12.pkcs12FromAsn1`) antes de salvar
- PFX armazenado como `LONGBLOB` em `tenant_credentials.certificate_pfx`
- Ao emitir, `NfseNacionalProvider` carrega o PFX, monta `httpsAgent` com certificado + chave
- Token OAuth obtido via client_credentials com mTLS → cacheado em `tenant_credentials.access_token` até `token_expires_at`
- `credentials.service.ts` sempre mascara `certificatePfx` e `certificatePassword` nos retornos (retorna `[PRESENT]` / `[MASKED]`)

### Ambiente Sandbox vs Produção
- Cada tenant tem credenciais **separadas** por environment (`sandbox` e `production`)
- Documento é criado com `environment: "sandbox"` ou `"production"` no payload
- Provider direciona para URL correspondente (`NFSE_ACIONAL_SANDBOX_URL` ou `NFSE_NACIONAL_PRODUCTION_URL`)
- Sem isolamento de dados no banco — o `environment` está no próprio documento

### Classificação de Erros SEFAZ (`nfse-error-codes.ts`)
- 28 códigos mapeados (E001–E902) com tipo `BUSINESS` ou `TECHNICAL`
- `BUSINESS` → NFS-e rejeitada permanentemente (ex: CNPJ inválido, código de serviço inexistente)
- `TECHNICAL` → Pode ser retentado (ex: serviço indisponível, timeout)
- `shouldRetry(errorCode)` retorna `boolean` — usado diretamente no processor

---

## 7. API — Endpoints

### Autenticação Admin

| Método | Rota                      | Auth     | Descrição                       |
|--------|---------------------------|----------|---------------------------------|
| POST   | `/v1/admin/auth/login`    | Não      | Login admin; retorna Bearer JWT |

### Gestão de Tenants (requer JWT admin)

| Método | Rota                                            | Auth       | Descrição                          |
|--------|-------------------------------------------------|------------|------------------------------------|
| POST   | `/v1/admin/tenants`                             | JWT admin  | Cria tenant                        |
| GET    | `/v1/admin/tenants`                             | JWT admin  | Lista todos os tenants             |
| GET    | `/v1/admin/tenants/:id`                         | JWT admin  | Detalha tenant                     |
| PATCH  | `/v1/admin/tenants/:id/toggle`                  | JWT admin  | Alterna status active/inactive     |
| POST   | `/v1/admin/tenants/:id/api-clients`             | JWT admin  | Cria API client; retorna secret UMA VEZ |
| GET    | `/v1/admin/tenants/:id/api-clients`             | JWT admin  | Lista API clients (sem secretHash) |
| DELETE | `/v1/admin/tenants/:id/api-clients/:clientId`   | JWT admin  | Revoga API client                  |
| POST   | `/v1/admin/tenants/:id/credentials`             | JWT admin  | Upload/atualização de certificado PFX |
| GET    | `/v1/admin/tenants/:id/credentials/:environment`| JWT admin  | Consulta credenciais (cert mascarado) |
| DELETE | `/v1/admin/tenants/:id/credentials/:environment`| JWT admin  | Remove credenciais                 |

### Documentos Fiscais (requer API Key)

| Método | Rota                                          | Auth    | Descrição                                           |
|--------|-----------------------------------------------|---------|-----------------------------------------------------|
| POST   | `/v1/documents/emit`                          | API Key | Emite NFS-e; idempotente por externalReference; retorna 202 |
| GET    | `/v1/documents/:id`                           | API Key | Consulta documento por ID interno                   |
| GET    | `/v1/documents/by-external-reference/:ref`    | API Key | Consulta por ID do sistema do cliente               |
| POST   | `/v1/documents/:id/cancel`                    | API Key | Solicita cancelamento; retorna 202                  |
| GET    | `/v1/documents/:id/events`                    | API Key | Histórico de eventos (audit trail)                  |
| POST   | `/v1/documents/:id/export`                    | API Key | Solicita exportação XML/PDF; retorna exportLogId    |
| POST   | `/v1/documents/:id/retry`                     | API Key | Força retry de documento em status `error`          |

### Exportações (requer API Key)

| Método | Rota              | Auth    | Descrição                              |
|--------|-------------------|---------|----------------------------------------|
| GET    | `/v1/exports/:id` | API Key | Consulta status e URL de download      |

### Webhooks (requer API Key)

| Método | Rota                      | Auth    | Descrição                              |
|--------|---------------------------|---------|----------------------------------------|
| POST   | `/v1/webhooks`            | API Key | Cria subscription; secret retornado UMA VEZ |
| GET    | `/v1/webhooks`            | API Key | Lista subscriptions do tenant          |
| GET    | `/v1/webhooks/:id`        | API Key | Detalha subscription                   |
| PATCH  | `/v1/webhooks/:id/toggle` | API Key | Ativa/desativa subscription            |
| DELETE | `/v1/webhooks/:id`        | API Key | Remove subscription                    |

### Infraestrutura (sem auth)

| Método | Rota             | Auth         | Descrição                                    |
|--------|------------------|--------------|----------------------------------------------|
| GET    | `/v1/health`     | Não          | Health check (verifica conexão MySQL)        |
| GET    | `/metrics`       | Não          | Métricas Prometheus (fora do prefix `/v1`)   |
| GET    | `/v1/docs`       | Não          | Swagger UI + JSON spec                       |
| GET    | `/admin/queues`  | Basic Auth   | Bull Board — painel de filas BullMQ          |

---

## 8. Filas BullMQ

### Nomes das Filas

| Constante       | Valor             | Processador                     |
|-----------------|-------------------|---------------------------------|
| `QUEUE_EMIT`    | `fiscal.emit`     | `EmissionProcessor`             |
| `QUEUE_CANCEL`  | `fiscal.cancel`   | `CancellationProcessor`         |
| `QUEUE_EXPORT`  | `fiscal.export`   | `ExportProcessor`               |
| `QUEUE_WEBHOOK` | `webhook.dispatch`| `WebhookProcessor`              |

### Estrutura dos Jobs

```typescript
// Emit
EmitJobData { documentId, tenantId, environment }

// Cancel
CancelJobData { documentId, tenantId, reason }

// Export
ExportJobData { documentId, tenantId, exportLogId, exportType }
```

### Configuração de Retry
- `attempts`: `QUEUE_MAX_ATTEMPTS` (default: 3)
- `backoff`: tipo `exponential`, delay `QUEUE_BACKOFF_DELAY` (default: 5000ms)
- `removeOnComplete`: true (jobs concluídos não ficam no Redis)
- `removeOnFail`: false (jobs falhados ficam para auditoria no Bull Board)

---

## 9. Observabilidade

### Métricas Prometheus (`/metrics`)

| Métrica                                  | Tipo      | Labels                   |
|------------------------------------------|-----------|--------------------------|
| `fiscal_documents_emitted_total`         | Counter   | tenant_id, environment   |
| `fiscal_documents_rejected_total`        | Counter   | tenant_id                |
| `fiscal_documents_cancelled_total`       | Counter   | tenant_id                |
| `fiscal_documents_error_total`           | Counter   | tenant_id                |
| `fiscal_webhooks_dispatched_total`       | Counter   | tenant_id, event_type    |
| `fiscal_webhooks_delivered_total`        | Counter   | tenant_id                |
| `fiscal_webhooks_failed_total`           | Counter   | tenant_id                |
| `fiscal_sefaz_request_duration_seconds`  | Histogram | operation, environment   |
| `fiscal_emission_queue_duration_seconds` | Histogram | —                        |
| `fiscal_documents_pending`               | Gauge     | —                        |
| `fiscal_queue_depth`                     | Gauge     | queue                    |
| `fiscal_nodejs_process_*`                | Gauge     | CPU, memória, GC         |

### Logging Pino
- **Produção:** JSON estruturado com campos `tenantId`, `requestId`, `method`, `url`, `statusCode`, `responseTime`
- **Desenvolvimento:** pino-pretty colorido
- Auto-logging ignora `GET /v1/health` (evita poluição nos logs)
- LOG_LEVEL configurável via ENV

### Painel Bull Board (`/admin/queues`)
- Visualização em tempo real de jobs em todas as 4 filas
- Autenticado com Basic Auth: `BULL_BOARD_USER` / `BULL_BOARD_PASS`
- Em produção trocar senha padrão `changeme`

---

## 10. Como Rodar o Projeto

### Desenvolvimento Local

```bash
# 1. Instalar dependências
cd "C:\Users\USUÁRIO\fiscal-emitter-api"
npm install

# 2. Copiar e configurar o .env
cp .env.example .env
# Editar .env com suas credenciais

# 3. Subir MySQL e Redis via Docker
docker-compose up -d
# Aguardar inicializar (~10s)

# 4. Aplicar schema inicial (apenas na primeira vez)
# O docker-compose já aplica schema.sql via docker-entrypoint-initdb.d/
# Para migrações adicionais:
npm run db:migrate:v2
npm run db:migrate:v3

# 5. Iniciar a API (com hot-reload)
npm run start:dev

# 6. Iniciar o Worker (outro terminal)
npm run start:worker
```

**Acesso local:**
- API: `http://localhost:3000/v1/docs` (Swagger)
- Bull Board: `http://localhost:3000/admin/queues` (admin / changeme)
- Métricas: `http://localhost:3000/metrics`
- Health: `http://localhost:3000/v1/health`

### Teste Rápido (Smoke Test)

```bash
# 1. Login admin (retorna JWT)
curl -X POST http://localhost:3000/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SUA_SENHA"}'

# 2. Criar tenant
curl -X POST http://localhost:3000/v1/admin/tenants \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Empresa Teste","document":"12345678000195","email":"teste@empresa.com"}'

# 3. Criar API client (guardar o secret!)
curl -X POST http://localhost:3000/v1/admin/tenants/TENANT_ID/api-clients \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Integração Principal"}'

# 4. Emitir NFS-e (usando seed de desenvolvimento)
curl -X POST http://localhost:3000/v1/documents/emit \
  -H "x-api-key: test_key_sandbox_001" \
  -H "x-api-secret: test_secret_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "sandbox",
    "externalReference": "pedido-001",
    "providerCnpj": "12345678000195",
    "taker": {"documentType":"cpf","document":"12345678901","name":"João Silva"},
    "service": {"code":"1.05","description":"Consultoria","amount":1000.00}
  }'
```

---

## 10a. Deploy em Produção (Railway)

| Item | Valor |
|------|-------|
| Repositório GitHub | `https://github.com/systemgn/fiscal-emitter-api` |
| Branch de deploy | `master` |
| Build | Docker (Dockerfile multi-stage) |
| Start command | `sh start.sh` (API + Worker no mesmo container) |
| Health check | `GET /v1/health` |
| Banco de dados | MySQL 8 no Railway |
| Cache/Fila | Redis no Railway |

**Estratégia de deploy no Railway (free plan — 3 serviços):**
- 1 serviço: container único com API + Worker via `start.sh`
- 1 serviço: MySQL
- 1 serviço: Redis

**`start.sh` — comportamento:**
```sh
node dist/src/worker/worker-entry &   # Worker em background
WORKER_PID=$!
node dist/src/main                    # API em foreground (mantém container vivo)
kill $WORKER_PID 2>/dev/null          # Se API morrer, mata o worker também
```

> **Nota sobre o build:** O `nest build` com `baseUrl: "./"` no `tsconfig.json` gera os arquivos em `dist/src/` (não `dist/`). Todos os entry points (`start.sh`, `package.json`) usam o caminho `dist/src/`.

> Deploy automático: qualquer `git push` na branch `master` aciona novo build no Railway.

**Variáveis de ambiente obrigatórias no Railway:**
```
NODE_ENV=production
DB_HOST=mysql.railway.internal        # DNS interno do serviço MySQL no Railway
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<senha do MySQL>
DB_NAME=fiscal_emitter
REDIS_HOST=redis.railway.internal     # DNS interno do serviço Redis no Railway
REDIS_PORT=6379
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt hash>
JWT_SECRET=<string longa aleatória>
BULL_BOARD_PASS=<senha segura>
BULL_BOARD_ENABLED=true
SWAGGER_ENABLED=true
```

> **Importante:** As variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `REDIS_HOST` e `REDIS_PORT` devem ser configuradas manualmente no serviço da API apontando para os DNS internos dos serviços MySQL e Redis do Railway. Sem isso, a API não conecta aos bancos e o healthcheck falha.

---

## 11. Decisões Técnicas Importantes

| Decisão | Motivo |
|---------|--------|
| NestJS (não Express puro) | DI nativo, módulos, guards, interceptors — reduz boilerplate; melhor testabilidade |
| BullMQ assíncrono (não síncrono) | SEFAZ tem latência imprevisível (segundos); cliente não deve aguardar; permite retry sem bloquear |
| Idempotência via SHA256 no servidor | Cliente não precisa gerar chave; UNIQUE constraint no BD previne race conditions; auditável |
| `external_reference` UNIQUE por tenant | Garante que mesmo ID do cliente nunca gera documento duplicado, além da idempotência de payload |
| API Key + Secret (não OAuth) | Stateless, simples de integrar, sem complexidade de refresh token para v1 |
| JWT apenas para admin | Admin precisa de sessão com expiração; tenants não (cada request é autenticado via bcrypt) |
| bcrypt no api_secret (não plaintext) | Se o banco vazar, secrets não são comprometidos; trade-off: ~100ms extra por request de API |
| node-forge para validação de PFX | Valida o certificado antes de salvar — evita erros silenciosos na emissão |
| PFX como LONGBLOB (não arquivo) | Servidor Railway é efêmero (sem disco persistente); banco garante durabilidade |
| Token OAuth cacheado em banco | Token A1 tem validade (~1h); reusar evita chamada extra de autenticação por emissão |
| `FiscalExportLog` inline em service.ts | Simplifica — evita criação de arquivo de entidade separado para tabela auxiliar. Deve ser registrada no `forFeature` dos módulos que a utilizam |
| API + Worker no mesmo container | Railway free plan limita a 3 serviços; `start.sh` contorna isso sem perda de funcionalidade |
| `removeOnFail: false` em BullMQ | Jobs falhados ficam visíveis no Bull Board para diagnóstico; não desaparecem silenciosamente |
| Classificação de erros SEFAZ | Erros de negócio (cliente errou) vs técnicos (SEFAZ instável) têm tratamento diferente — retry só faz sentido em técnicos |
| Pino (não Winston) | 5-10x mais rápido; JSON nativo; sem config complexa para structured logging |
| `utf8mb4` no MySQL | Suporte a caracteres especiais em nomes/descrições; sem limitação de índice (MySQL 8, não 5.5) |
| Webhook com HMAC-SHA256 | Padrão de mercado (Stripe, GitHub); simples de validar; secret assimétrico ao payload |
| Prometheus em `/metrics` (não `/v1/metrics`) | Padrão de facto; fora do prefix da API para não confundir com endpoints de negócio |
| `TenantThrottleGuard` (não global) | Rate limit por tenant isola abusos; clientes pagantes não são afetados por mal uso de outros |

---

## 12. Formato das Respostas

Todas as respostas são envolvidas pelo `ResponseInterceptor`:

### Sucesso
```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": {
    "timestamp": "2026-04-02T10:00:00.000Z",
    "path": "/v1/documents/emit"
  }
}
```

### Erro
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "taker.document must be a valid CPF or CNPJ",
    "statusCode": 400
  },
  "meta": {
    "timestamp": "2026-04-02T10:00:00.000Z",
    "path": "/v1/documents/emit"
  }
}
```

---

## 13. Seed de Desenvolvimento

O `database/schema.sql` inclui um seed inicial para facilitar testes locais:

| Campo      | Valor                                          |
|------------|------------------------------------------------|
| Tenant ID  | `00000000-0000-0000-0000-000000000001`          |
| Empresa    | Empresa Demo Ltda                              |
| CNPJ       | 12345678000195                                 |
| API Key    | `test_key_sandbox_001`                         |
| API Secret | `test_secret_abc123` (hash bcrypt no banco)    |

> **Atenção:** Este seed é apenas para desenvolvimento. Em produção criar tenants via `POST /v1/admin/tenants`.

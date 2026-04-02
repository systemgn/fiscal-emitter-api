# Deploy Railway — Fiscal Emitter API

## Serviços necessários

| Serviço   | Tipo             | Notas                                  |
|-----------|------------------|----------------------------------------|
| API       | Node.js / Docker | CMD: `node dist/main`                  |
| Worker    | Node.js / Docker | CMD: `node dist/worker/worker-entry`   |
| MySQL     | Railway Plugin   | MySQL 8.0                              |
| Redis     | Railway Plugin   | Redis 7                                |

---

## Passo a passo

### 1. Criar projeto no Railway

```bash
railway init
railway link
```

### 2. Adicionar MySQL e Redis (via Dashboard)

No painel Railway:
- `+ New` → `Database` → `MySQL`
- `+ New` → `Database` → `Redis`

### 3. Variáveis de ambiente (serviço API e Worker)

```env
NODE_ENV=production
PORT=3000
API_PREFIX=v1

# Fornecidas automaticamente pelo Railway ao linkar os serviços:
DB_HOST=${{MySQL.MYSQL_HOST}}
DB_PORT=${{MySQL.MYSQL_PORT}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}

REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

QUEUE_EMIT_CONCURRENCY=5
QUEUE_CANCEL_CONCURRENCY=3
QUEUE_EXPORT_CONCURRENCY=2
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=5000

BCRYPT_ROUNDS=10
```

### 4. Criar schema no MySQL do Railway

```bash
# Via Railway CLI (execute uma vez)
railway run mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < database/schema.sql
```

Ou via MySQL Workbench conectando com as credenciais externas do Railway.

### 5. Deploy do serviço API

```bash
# railway.toml já configurado com Dockerfile
git push origin main
```

Railway detecta o `railway.toml` e usa o Dockerfile automaticamente.

### 6. Deploy do Worker (serviço separado)

No Railway Dashboard:
- `+ New Service` → `GitHub Repo` (mesmo repositório)
- Override `Start Command`: `node dist/worker/worker-entry`
- Adicionar as mesmas variáveis de ambiente

---

## Cuidados com filesystem efêmero

Railway usa filesystem **efêmero** — qualquer arquivo gravado no container é perdido em redeploy.

| O que fazer                        | Como                                     |
|------------------------------------|------------------------------------------|
| Não gravar XML/PDF em disco        | Usar URL temporária (S3, GCS, link SEFAZ)|
| Não gravar certificados em disco   | Armazenar bytes no MySQL (`tenant_credentials.certificate_pfx`) |
| Não confiar em `/tmp` entre deploys | Redis para estado temporário de sessão  |

---

## Healthcheck

Railway usa o healthcheck definido em `railway.toml`:
```
healthcheckPath = "/v1/health"
healthcheckTimeout = 30
```

O endpoint `/v1/health` verifica a conexão com MySQL via `@nestjs/terminus`.

---

## Escalabilidade

- **API** → escala horizontalmente (stateless, múltiplas instâncias)
- **Worker** → BullMQ garante que cada job é processado por exatamente 1 worker
  mesmo com múltiplas instâncias (Redis como coordenador)
- **MySQL** → único nó no Railway; para produção real considerar PlanetScale ou RDS

---

## Monitoramento de filas (opcional)

Adicionar Bull Board para visualizar filas:

```typescript
// Em app.module.ts (desenvolvimento)
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';

BullBoardModule.forRoot({
  route: '/admin/queues',
  adapter: ExpressAdapter,
}),
```

Em produção, proteja a rota com autenticação básica.

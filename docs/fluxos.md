# Fluxos — Fiscal Emitter API

## 1. Emissão

```
Cliente → POST /v1/documents/emit
  │
  ├─ [Guard] Valida x-api-key + x-api-secret → carrega tenant
  ├─ [DTO] Valida campos obrigatórios (class-validator)
  ├─ [Service] Calcula idempotency_key = SHA256(tenantId|extRef|payload)
  │
  ├─ [Idempotência] SELECT WHERE idempotency_key → já existe?
  │     └─ SIM → retorna 202 com documento existente (sem duplicar)
  │
  ├─ [Service] Cria fiscal_document com status=pending
  ├─ [Service] Salva evento emission_requested
  ├─ [BullMQ] Enfileira job emit:{documentId}
  └─ Retorna 202 com documento (status=pending)

Worker (EmissionProcessor)
  ├─ Pega job da fila fiscal.emit
  ├─ Atualiza status → processing
  ├─ Chama FiscalProvider.emit(payload)
  │
  ├─ SUCESSO (SEFAZ aceitou)
  │     ├─ Atualiza documento: status=issued, nfseNumber, nfseCode, ...
  │     └─ Salva evento issued
  │
  ├─ ERRO DE NEGÓCIO (SEFAZ rejeitou, ex: CNPJ inválido)
  │     ├─ Atualiza status → rejected
  │     ├─ Salva errorCode + errorMessage
  │     └─ NÃO relança exception (sem retry)
  │
  └─ ERRO TÉCNICO (timeout, rede, etc)
        ├─ Atualiza status → error
        ├─ Relança exception → BullMQ agenda retry
        │     attempt 1: aguarda 5s
        │     attempt 2: aguarda 25s  (exponencial ×5)
        │     attempt 3: aguarda 125s
        └─ Após 3 falhas → job vai para dead-letter (removeOnFail: false)
```

---

## 2. Cancelamento

```
Cliente → POST /v1/documents/:id/cancel  { reason }
  │
  ├─ findById + ownership check (tenant isolation)
  ├─ Valida status === 'issued' (apenas emitidos podem ser cancelados)
  ├─ Atualiza: status=processing, cancelReason, cancelRequestedAt
  ├─ Salva evento cancelled (statusTo=processing)
  ├─ Enfileira job cancel:{documentId}
  └─ Retorna 202 com documento (status=processing)

Worker (CancellationProcessor)
  ├─ Chama FiscalProvider.cancel({ nfseNumber, reason })
  ├─ SUCESSO → status=cancelled, cancelledAt
  └─ ERRO    → status=error + retry com backoff
```

---

## 3. Idempotência

```
Requisição de emissão recebida
  │
  ├─ Gera idempotency_key = SHA256(tenantId + "|" + externalReference + "|" + JSON.stringify(dto))
  │
  ├─ SELECT * FROM fiscal_documents WHERE tenant_id=? AND idempotency_key=?
  │     └─ ENCONTRADO → retorna documento existente (202, sem inserção, sem job)
  │
  └─ NÃO ENCONTRADO → prossegue com criação normal

Garantia adicional:
  UNIQUE KEY uk_idempotency (tenant_id, idempotency_key)
  UNIQUE KEY uk_external_ref (tenant_id, external_reference)
  → Race condition entre dois requests simultâneos resulta em constraint violation
    capturada e convertida em retorno do documento existente.

Importante:
  - Qualquer alteração no payload (mesmo 1 centavo) gera chave diferente → novo documento
  - externalReference por si só também é UNIQUE por tenant → garante unicidade de negócio
```

---

## 4. Retry com Backoff Exponencial

```
Job criado com:
  attempts: 3
  backoff: { type: 'exponential', delay: 5000 }

Sequência de tentativas:
  attempt 1 → falha → aguarda 5000ms  (5s)
  attempt 2 → falha → aguarda 25000ms (25s = 5s × 5^1)
  attempt 3 → falha → job marcado como 'failed' (removeOnFail: false)

Dead-letter:
  Jobs failed ficam no Redis para inspeção/replay manual
  Visíveis no Bull Board (painel de monitoramento opcional)

Replay manual via BullMQ CLI ou Bull Board:
  await queue.retryJobs({ status: 'failed' })
```

---

## 5. Erro Técnico vs Erro de Negócio

```
Erro TÉCNICO (relançar → retry automático):
  - Timeout de rede para SEFAZ
  - Redis indisponível
  - MySQL connection lost
  - Exceção não tratada

Erro de NEGÓCIO (NÃO relançar → status=rejected, sem retry):
  - CNPJ do prestador inválido
  - Código de serviço não permitido no município
  - NFS-e já cancelada
  - Período fiscal encerrado

Distinção no processor:
  if (result.success === false) {
    // Erro de negócio → rejected, sem throw
  } else {
    // Erro técnico → throw err (BullMQ faz retry)
  }
```

---

## 6. Exportação (XML/PDF)

```
Cliente → POST /v1/documents/:id/export { type: "xml" }
  │
  ├─ Valida status === 'issued'
  ├─ Cria registro em fiscal_exports_log (status=pending)
  ├─ Enfileira job export:{exportLogId}
  └─ Retorna 202 com exportLogId

Worker (ExportProcessor)
  ├─ Chama FiscalProvider.export({ nfseNumber, type })
  ├─ Provider obtém URL temporária (S3 presigned ou link SEFAZ)
  ├─ SUCESSO → exportLog: status=ready, downloadUrl, urlExpiresAt
  └─ ERRO    → exportLog: status=error

Cliente verifica:
  (polling ou webhook — webhook não implementado no MVP)
  GET /v1/exports/:exportLogId  ← endpoint a implementar no v2

Nota: XML/PDF NUNCA é armazenado no servidor (filesystem efêmero Railway)
  → Apenas a URL temporária é persistida no banco.
```

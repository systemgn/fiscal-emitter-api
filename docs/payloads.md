# Payloads JSON — Fiscal Emitter API

## Headers obrigatórios (todas as rotas autenticadas)

```
x-api-key: test_key_sandbox_001
x-api-secret: test_secret_abc123
Content-Type: application/json
```

---

## POST /v1/documents/emit

### Request
```json
{
  "externalReference": "PEDIDO-2024-001",
  "environment": "sandbox",
  "providerCnpj": "12345678000195",
  "providerName": "Empresa Demo Ltda",
  "taker": {
    "documentType": "cpf",
    "document": "12345678901",
    "name": "João da Silva",
    "email": "joao@email.com",
    "address": {
      "street": "Rua das Flores",
      "number": "123",
      "complement": "Apto 4",
      "district": "Centro",
      "cityCode": "3550308",
      "cityName": "São Paulo",
      "state": "SP",
      "zipCode": "01001000"
    }
  },
  "service": {
    "code": "17.06",
    "description": "Serviço de consultoria em tecnologia da informação",
    "amount": 1500.00,
    "taxes": {
      "issRate": 0.05,
      "deductions": 0,
      "pisAmount": 9.75,
      "cofinsAmount": 45.00,
      "irAmount": 0,
      "csllAmount": 0,
      "inssAmount": 0
    }
  },
  "rps": {
    "number": "1001",
    "series": "A",
    "type": "RPS"
  }
}
```

### Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "externalReference": "PEDIDO-2024-001",
    "status": "pending",
    "environment": "sandbox",
    "providerCnpj": "12345678000195",
    "providerName": "Empresa Demo Ltda",
    "takerName": "João da Silva",
    "serviceAmount": "1500.00",
    "issRate": "0.0500",
    "issAmount": "75.00",
    "netAmount": "1370.25",
    "nfseNumber": null,
    "createdAt": "2024-04-02T10:00:00.000Z"
  },
  "error": null,
  "meta": {
    "timestamp": "2024-04-02T10:00:00.000Z",
    "path": "/v1/documents/emit"
  }
}
```

---

## GET /v1/documents/:id

### Response (documento emitido)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "issued",
    "nfseNumber": "1234567",
    "nfseCode": "VER-AB12CD34",
    "nfseIssuedAt": "2024-04-02T10:00:05.000Z",
    "serviceAmount": "1500.00",
    "netAmount": "1370.25"
  },
  "error": null,
  "meta": { "timestamp": "2024-04-02T10:00:10.000Z", "path": "/v1/documents/550e8400..." }
}
```

---

## GET /v1/documents/by-external-reference/:externalReference

```
GET /v1/documents/by-external-reference/PEDIDO-2024-001
```
Mesma estrutura de resposta do GET by id.

---

## POST /v1/documents/:id/cancel

### Request
```json
{
  "reason": "Serviço não prestado — cliente cancelou contrato"
}
```

### Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-...",
    "status": "processing",
    "cancelReason": "Serviço não prestado — cliente cancelou contrato",
    "cancelRequestedAt": "2024-04-02T11:00:00.000Z"
  },
  "error": null,
  "meta": { "timestamp": "2024-04-02T11:00:00.000Z", "path": "/v1/documents/550e.../cancel" }
}
```

---

## GET /v1/documents/:id/events

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "eventType": "emission_requested",
      "statusFrom": null,
      "statusTo": "pending",
      "metadata": { "externalReference": "PEDIDO-2024-001" },
      "createdAt": "2024-04-02T10:00:00.000Z"
    },
    {
      "id": 2,
      "eventType": "processing",
      "statusFrom": "pending",
      "statusTo": "processing",
      "metadata": null,
      "createdAt": "2024-04-02T10:00:01.000Z"
    },
    {
      "id": 3,
      "eventType": "issued",
      "statusFrom": "processing",
      "statusTo": "issued",
      "metadata": { "nfseNumber": "1234567", "nfseCode": "VER-AB12CD34" },
      "createdAt": "2024-04-02T10:00:05.000Z"
    }
  ],
  "error": null,
  "meta": { "timestamp": "2024-04-02T10:00:10.000Z", "path": "/v1/documents/550e.../events" }
}
```

---

## POST /v1/documents/:id/export

### Request
```json
{
  "type": "xml"
}
```

### Response (202 Accepted)
```json
{
  "success": true,
  "data": {
    "exportLogId": "7f3c8d2a-1b4e-4a9f-8c2d-3e5f6a7b8c9d"
  },
  "error": null,
  "meta": { "timestamp": "2024-04-02T10:01:00.000Z", "path": "/v1/documents/550e.../export" }
}
```

---

## GET /v1/health

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

---

## Erros

### 401 Unauthorized
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "HTTP_401",
    "message": "Missing x-api-key or x-api-secret headers",
    "statusCode": 401
  },
  "meta": { "timestamp": "...", "path": "..." }
}
```

### 404 Not Found
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "HTTP_404",
    "message": "Document abc123 not found",
    "statusCode": 404
  },
  "meta": { "timestamp": "...", "path": "..." }
}
```

### 400 Bad Request (validação)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "HTTP_400",
    "message": "taker.document must be 11 (CPF) or 14 (CNPJ) digits; service.amount must be a positive number",
    "statusCode": 400
  },
  "meta": { "timestamp": "...", "path": "..." }
}
```

### 409 Conflict (idempotência)
A API **não** retorna 409 — retorna 202 com o documento existente (idempotente por design).

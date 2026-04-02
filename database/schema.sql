-- ============================================================
-- Fiscal Emitter API — Schema MySQL
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================

CREATE DATABASE IF NOT EXISTS fiscal_emitter
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fiscal_emitter;

-- -------------------------------------------------------
-- tenants
-- -------------------------------------------------------
CREATE TABLE tenants (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  document      VARCHAR(14)  NOT NULL COMMENT 'CNPJ sem máscara',
  email         VARCHAR(191) NOT NULL,
  status        ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_document (document),
  UNIQUE KEY uk_tenant_email    (email),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- api_clients  (credenciais de acesso por tenant)
-- -------------------------------------------------------
CREATE TABLE api_clients (
  id              CHAR(36)     NOT NULL,
  tenant_id       CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  api_key         VARCHAR(64)  NOT NULL,
  api_secret_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt do secret',
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_used_at    TIMESTAMP    NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_key  (api_key),
  KEY idx_tenant_id (tenant_id),
  CONSTRAINT fk_ac_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- tenant_credentials  (certificado + token NFS-e Nacional)
-- -------------------------------------------------------
CREATE TABLE tenant_credentials (
  id                   CHAR(36)    NOT NULL,
  tenant_id            CHAR(36)    NOT NULL,
  environment          ENUM('sandbox','production') NOT NULL DEFAULT 'sandbox',
  certificate_pfx      LONGBLOB    NULL  COMMENT 'Cert A1 em bytes (PFX/P12)',
  certificate_password VARCHAR(255) NULL,
  certificate_expires_at DATE      NULL,
  access_token         TEXT        NULL,
  token_expires_at     TIMESTAMP   NULL,
  extra_config         JSON        NULL,
  created_at           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_env (tenant_id, environment),
  CONSTRAINT fk_tc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- fiscal_documents
-- -------------------------------------------------------
CREATE TABLE fiscal_documents (
  id                   CHAR(36)     NOT NULL,
  tenant_id            CHAR(36)     NOT NULL,
  external_reference   VARCHAR(255) NOT NULL,
  idempotency_key      VARCHAR(64)  NOT NULL COMMENT 'SHA256(tenant+ext_ref+payload)',
  status               ENUM('pending','processing','issued','cancelled','error','rejected')
                         NOT NULL DEFAULT 'pending',
  environment          ENUM('sandbox','production') NOT NULL DEFAULT 'sandbox',
  -- Prestador
  provider_cnpj        VARCHAR(14)  NOT NULL,
  provider_name        VARCHAR(255) NOT NULL,
  -- Tomador
  taker_document_type  ENUM('cpf','cnpj') NOT NULL,
  taker_document       VARCHAR(14)  NOT NULL,
  taker_name           VARCHAR(255) NOT NULL,
  taker_email          VARCHAR(191) NULL,
  -- Endereço tomador
  taker_street         VARCHAR(255) NULL,
  taker_number         VARCHAR(20)  NULL,
  taker_complement     VARCHAR(100) NULL,
  taker_district       VARCHAR(100) NULL,
  taker_city_code      VARCHAR(10)  NULL COMMENT 'Código IBGE',
  taker_city_name      VARCHAR(100) NULL,
  taker_state          CHAR(2)      NULL,
  taker_zip_code       VARCHAR(8)   NULL,
  -- Serviço
  service_code         VARCHAR(20)  NOT NULL COMMENT 'LC 116/2003',
  service_description  TEXT         NOT NULL,
  service_amount       DECIMAL(15,2) NOT NULL,
  deductions           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  iss_rate             DECIMAL(7,4)  NOT NULL DEFAULT 0.0000,
  iss_amount           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pis_amount           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  cofins_amount        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ir_amount            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  csll_amount          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  inss_amount          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  net_amount           DECIMAL(15,2) NOT NULL,
  -- Resposta SEFAZ
  nfse_number          VARCHAR(50)  NULL,
  nfse_code            VARCHAR(50)  NULL COMMENT 'Código de verificação',
  nfse_issued_at       TIMESTAMP    NULL,
  nfse_rps_number      VARCHAR(50)  NULL,
  nfse_rps_series      VARCHAR(5)   NULL,
  nfse_rps_type        VARCHAR(5)   NULL DEFAULT 'RPS',
  cancel_reason        VARCHAR(255) NULL,
  cancel_requested_at  TIMESTAMP    NULL,
  cancelled_at         TIMESTAMP    NULL,
  -- Controle
  error_code           VARCHAR(50)  NULL,
  error_message        TEXT         NULL,
  retry_count          INT          NOT NULL DEFAULT 0,
  raw_response         JSON         NULL COMMENT 'Última resposta sem XML/PDF binário',
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_idempotency   (tenant_id, idempotency_key),
  UNIQUE KEY uk_external_ref  (tenant_id, external_reference),
  UNIQUE KEY uk_nfse_number   (tenant_id, nfse_number),
  KEY idx_tenant_status  (tenant_id, status),
  KEY idx_tenant_created (tenant_id, created_at),
  KEY idx_provider_cnpj  (provider_cnpj),
  CONSTRAINT fk_fd_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- fiscal_document_events  (log de ciclo de vida)
-- -------------------------------------------------------
CREATE TABLE fiscal_document_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NOT NULL,
  event_type  VARCHAR(60)  NOT NULL
    COMMENT 'emission_requested|processing|issued|error|cancelled|export_requested|retry',
  status_from VARCHAR(30)  NULL,
  status_to   VARCHAR(30)  NULL,
  message     TEXT         NULL,
  metadata    JSON         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_document_id (document_id),
  KEY idx_tenant_type (tenant_id, event_type),
  KEY idx_created (created_at),
  CONSTRAINT fk_fde_document FOREIGN KEY (document_id)
    REFERENCES fiscal_documents (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- fiscal_requests  (log de chamadas à SEFAZ)
-- -------------------------------------------------------
CREATE TABLE fiscal_requests (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id      CHAR(36)    NULL,
  tenant_id        CHAR(36)    NOT NULL,
  operation        VARCHAR(50) NOT NULL COMMENT 'emit|cancel|status|export',
  provider         VARCHAR(50) NOT NULL DEFAULT 'nfse_nacional',
  http_method      VARCHAR(10) NULL,
  endpoint         VARCHAR(500) NULL,
  request_payload  JSON        NULL,
  response_status  INT         NULL,
  response_body    JSON        NULL,
  duration_ms      INT         NULL,
  success          TINYINT(1)  NOT NULL DEFAULT 0,
  error_message    TEXT        NULL,
  created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_document_id (document_id),
  KEY idx_tenant_op   (tenant_id, operation),
  KEY idx_created     (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- fiscal_jobs  (controle de jobs BullMQ)
-- -------------------------------------------------------
CREATE TABLE fiscal_jobs (
  id            CHAR(36)    NOT NULL,
  document_id   CHAR(36)    NOT NULL,
  tenant_id     CHAR(36)    NOT NULL,
  job_type      ENUM('emit','cancel','export','retry') NOT NULL,
  bullmq_job_id VARCHAR(255) NULL,
  status        ENUM('queued','active','completed','failed','delayed') NOT NULL DEFAULT 'queued',
  attempts      INT         NOT NULL DEFAULT 0,
  max_attempts  INT         NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMP   NULL,
  error_message TEXT        NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_document_id (document_id),
  KEY idx_status      (status),
  KEY idx_tenant_type (tenant_id, job_type),
  CONSTRAINT fk_fj_document FOREIGN KEY (document_id) REFERENCES fiscal_documents (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- fiscal_exports_log
-- -------------------------------------------------------
CREATE TABLE fiscal_exports_log (
  id             CHAR(36)   NOT NULL,
  document_id    CHAR(36)   NOT NULL,
  tenant_id      CHAR(36)   NOT NULL,
  export_type    ENUM('xml','pdf') NOT NULL,
  status         ENUM('pending','processing','ready','expired','error') NOT NULL DEFAULT 'pending',
  download_url   TEXT       NULL COMMENT 'URL temporária (S3 presigned)',
  url_expires_at TIMESTAMP  NULL,
  downloaded_at  TIMESTAMP  NULL,
  error_message  TEXT       NULL,
  created_at     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_document_id  (document_id),
  KEY idx_tenant_status (tenant_id, status),
  CONSTRAINT fk_fel_document FOREIGN KEY (document_id) REFERENCES fiscal_documents (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- Seed: tenant + api_client de exemplo (sandbox)
-- api_key: test_key_sandbox_001
-- api_secret: test_secret_abc123  (hash bcrypt abaixo)
-- -------------------------------------------------------
INSERT INTO tenants (id, name, document, email, status) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Empresa Demo Ltda',
   '12345678000195',
   'demo@empresa.com.br',
   'active');

-- hash bcrypt de 'test_secret_abc123' (rounds=10)
INSERT INTO api_clients (id, tenant_id, name, api_key, api_secret_hash, status) VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Integração Sandbox',
   'test_key_sandbox_001',
   '$2b$10$X5gLbB1xF3VHq2M9P0K4ue6rDJvfNk7W8mRzYoC1sT.pU3iAhILQ2',
   'active');

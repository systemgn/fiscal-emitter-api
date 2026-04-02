-- ============================================================
-- Migration v2 — Webhooks + Tenant Credentials Update
-- Aplicar com: npm run db:migrate:v2
-- ============================================================

USE fiscal_emitter;

-- -------------------------------------------------------
-- webhook_subscriptions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id          CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NOT NULL,
  name        VARCHAR(100) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  secret      VARCHAR(64)  NOT NULL COMMENT 'HMAC-SHA256 signing secret',
  events      JSON         NOT NULL COMMENT '["document.issued","document.rejected","document.cancelled"]',
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tenant_status (tenant_id, status),
  CONSTRAINT fk_ws_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- webhook_deliveries
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id               CHAR(36)    NOT NULL,
  subscription_id  CHAR(36)    NOT NULL,
  document_id      CHAR(36)    NOT NULL,
  tenant_id        CHAR(36)    NOT NULL,
  event_type       VARCHAR(60) NOT NULL,
  payload          JSON        NOT NULL,
  status           ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  http_status      INT         NULL,
  response_body    TEXT        NULL,
  attempts         INT         NOT NULL DEFAULT 0,
  last_attempt_at  TIMESTAMP   NULL,
  created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subscription_id (subscription_id),
  KEY idx_document_id     (document_id),
  KEY idx_tenant_status   (tenant_id, status),
  KEY idx_created         (created_at),
  CONSTRAINT fk_wd_subscription FOREIGN KEY (subscription_id)
    REFERENCES webhook_subscriptions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- rate_limit_hits  (throttle por tenant)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  CHAR(36)    NOT NULL,
  endpoint   VARCHAR(100) NOT NULL,
  hit_count  INT         NOT NULL DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_endpoint_window (tenant_id, endpoint, window_start),
  KEY idx_window_start (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- Evento de webhook na fiscal_document_events
-- Adiciona 'webhook_dispatched' como event_type válido
-- (sem ALTER ENUM — apenas documentamos; MySQL aceita texto livre nessa coluna)
-- -------------------------------------------------------

-- Índice extra em fiscal_documents para busca por status + data (relatórios)
ALTER TABLE fiscal_documents
  ADD INDEX IF NOT EXISTS idx_tenant_env_status (tenant_id, environment, status);

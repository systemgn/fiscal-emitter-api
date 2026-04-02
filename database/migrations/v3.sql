-- ============================================================
-- Migration v3 — Admin JWT + TenantCredentials entity register
-- Aplicar após v2.sql
-- ============================================================

USE fiscal_emitter;

-- tenant_credentials já existe no schema.sql inicial.
-- Esta migration garante que a coluna extra_config seja JSON
-- (compatível com MySQL 8; em 5.7 usar LONGTEXT se necessário)
ALTER TABLE tenant_credentials
  MODIFY COLUMN extra_config JSON NULL;

-- Índice para busca por api_key (performance de autenticação)
-- Já existe UNIQUE KEY uk_api_key em api_clients, garante apenas
ALTER TABLE api_clients
  ADD INDEX IF NOT EXISTS idx_api_key_status (api_key, status);

-- Log de logins admin (auditoria básica)
CREATE TABLE IF NOT EXISTS admin_login_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username   VARCHAR(100)    NOT NULL,
  ip_address VARCHAR(45)     NOT NULL,
  success    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_created (created_at),
  KEY idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

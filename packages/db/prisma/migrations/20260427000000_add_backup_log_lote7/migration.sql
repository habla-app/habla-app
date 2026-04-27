-- Lote 7: tabla BackupLog para auto-monitoreo de backups a R2.
--
-- Reemplaza el state in-memory de la implementación previa por un log
-- persistente. Cada intento (éxito o fracaso) inserta un row. El job
-- consulta los últimos 2 rows para decidir si emite alerta por email
-- al ADMIN_ALERT_EMAIL (2 fallos consecutivos).
--
-- Idempotente: IF NOT EXISTS protege un re-run accidental.

CREATE TABLE IF NOT EXISTS "backup_logs" (
  "id"           TEXT      NOT NULL,
  "fechaIntento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ok"           BOOLEAN   NOT NULL,
  "archivo"      TEXT,
  "bytes"        INTEGER,
  "durationMs"   INTEGER,
  "errorMsg"     TEXT,
  CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backup_logs_fechaIntento_idx"
  ON "backup_logs" ("fechaIntento");

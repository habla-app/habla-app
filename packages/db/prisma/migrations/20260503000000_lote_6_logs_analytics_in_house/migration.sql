-- Lote 6 (May 2026): logs + analytics in-house.
--
-- Reemplaza a Sentry + PostHog (eliminados en Lote 1) con dos tablas
-- propias en Postgres + dashboards admin (/admin/dashboard, /admin/logs).
-- El handler POST /api/v1/analytics/track inserta fire-and-forget en
-- `eventos_analitica`; el logger Pino (apps/web/lib/services/logger.ts)
-- intercepta nivel error/critical y persiste async en `log_errores`.
--
-- Migración no destructiva — todas las operaciones son aditivas:
--   2 CREATE TABLE + 4 índices + 4 FOREIGN KEY (SET NULL al borrar usuario).
-- No requiere backup pre-deploy según la regla del proyecto (sólo
-- migraciones que comprometen integridad —renombres, cambios de tipo,
-- conversiones, FKs movidas— exigen backup).
--
-- Tablas nuevas:
--   - log_errores       1 fila por error/warning persistido (alimenta /admin/logs + cron M)
--   - eventos_analitica 1 fila por evento (signup_completed, $pageview, etc.)

-- ---------------------------------------------------------------------------
-- (1) log_errores — errores y warnings persistidos
-- ---------------------------------------------------------------------------

CREATE TABLE "log_errores" (
  "id"        TEXT NOT NULL,
  "level"     TEXT NOT NULL,
  "source"    TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "stack"     TEXT,
  "userId"    TEXT,
  "metadata"  JSONB,
  "creadoEn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "log_errores_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "log_errores"
  ADD CONSTRAINT "log_errores_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "log_errores_level_creadoEn_idx" ON "log_errores"("level", "creadoEn" DESC);

-- ---------------------------------------------------------------------------
-- (2) eventos_analitica — eventos de producto/UX
-- ---------------------------------------------------------------------------

CREATE TABLE "eventos_analitica" (
  "id"         TEXT NOT NULL,
  "evento"     TEXT NOT NULL,
  "userId"     TEXT,
  "sessionId"  TEXT,
  "props"      JSONB,
  "pais"       TEXT,
  "userAgent"  TEXT,
  "pagina"     TEXT,
  "referrer"   TEXT,
  "creadoEn"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "eventos_analitica_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "eventos_analitica"
  ADD CONSTRAINT "eventos_analitica_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "eventos_analitica_evento_creadoEn_idx" ON "eventos_analitica"("evento", "creadoEn" DESC);
CREATE INDEX "eventos_analitica_userId_creadoEn_idx" ON "eventos_analitica"("userId", "creadoEn" DESC) WHERE "userId" IS NOT NULL;

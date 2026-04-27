-- Lote 8 — Culqi mockeado + Contabilidad de partida doble + Conciliación
-- bancaria + Auditoría continua (Job I).
--
-- 1 enum nuevo (TipoCuenta) + 8 tablas nuevas:
--   - eventos_culqi               (idempotencia webhook)
--   - cuentas_contables           (plan de cuentas; seed 11 cuentas via endpoint)
--   - asientos                    (asientos de partida doble)
--   - asientos_lineas             (líneas debe/haber por cuenta)
--   - movimientos_banco_esperados (proyección de Caja-Banco al banco)
--   - movimientos_banco_reales    (parseado del extracto Interbank)
--   - cargas_extracto_banco       (audit de cada upload de CSV)
--   - auditoria_contable_logs     (Job I — mismo patrón que BackupLog)
--
-- Idempotente: IF NOT EXISTS protege todo. NO modifica tablas existentes.

DO $$ BEGIN
  CREATE TYPE "TipoCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Webhook idempotency

CREATE TABLE IF NOT EXISTS "eventos_culqi" (
  "id"          TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "tipo"        TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "procesadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId"   TEXT,
  "cargoId"     TEXT,
  CONSTRAINT "eventos_culqi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "eventos_culqi_eventId_key"
  ON "eventos_culqi" ("eventId");

CREATE INDEX IF NOT EXISTS "eventos_culqi_procesadoEn_idx"
  ON "eventos_culqi" ("procesadoEn");

-- Plan de cuentas

CREATE TABLE IF NOT EXISTS "cuentas_contables" (
  "id"          TEXT NOT NULL,
  "codigo"      TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "tipo"        "TipoCuenta" NOT NULL,
  "saldoActual" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "activa"      BOOLEAN NOT NULL DEFAULT true,
  "creadaEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_contables_codigo_key"
  ON "cuentas_contables" ("codigo");

-- Asientos (partida doble)

CREATE TABLE IF NOT EXISTS "asientos" (
  "id"          TEXT NOT NULL,
  "fecha"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "origenTipo"  TEXT NOT NULL,
  "origenId"    TEXT,
  "descripcion" TEXT NOT NULL,
  "totalDebe"   DECIMAL(14,2) NOT NULL,
  "totalHaber"  DECIMAL(14,2) NOT NULL,
  "metadata"    JSONB,
  CONSTRAINT "asientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asientos_fecha_idx" ON "asientos" ("fecha");
CREATE INDEX IF NOT EXISTS "asientos_origenTipo_origenId_idx"
  ON "asientos" ("origenTipo", "origenId");

CREATE TABLE IF NOT EXISTS "asientos_lineas" (
  "id"          TEXT NOT NULL,
  "asientoId"   TEXT NOT NULL,
  "cuentaId"    TEXT NOT NULL,
  "debe"        DECIMAL(14,2) NOT NULL DEFAULT 0,
  "haber"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  "descripcion" TEXT,
  CONSTRAINT "asientos_lineas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asientos_lineas_asientoId_idx"
  ON "asientos_lineas" ("asientoId");
CREATE INDEX IF NOT EXISTS "asientos_lineas_cuentaId_idx"
  ON "asientos_lineas" ("cuentaId");

-- FKs (idempotente vía bloque)

DO $$ BEGIN
  ALTER TABLE "asientos_lineas"
    ADD CONSTRAINT "asientos_lineas_asientoId_fkey"
    FOREIGN KEY ("asientoId") REFERENCES "asientos" ("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asientos_lineas"
    ADD CONSTRAINT "asientos_lineas_cuentaId_fkey"
    FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables" ("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Conciliación bancaria

CREATE TABLE IF NOT EXISTS "movimientos_banco_esperados" (
  "id"              TEXT NOT NULL,
  "fecha"           TIMESTAMP(3) NOT NULL,
  "monto"           DECIMAL(14,2) NOT NULL,
  "descripcion"     TEXT NOT NULL,
  "asientoId"       TEXT NOT NULL,
  "conciliadoConId" TEXT,
  "conciliadoEn"    TIMESTAMP(3),
  CONSTRAINT "movimientos_banco_esperados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "movimientos_banco_esperados_fecha_idx"
  ON "movimientos_banco_esperados" ("fecha");
CREATE INDEX IF NOT EXISTS "movimientos_banco_esperados_conciliadoConId_idx"
  ON "movimientos_banco_esperados" ("conciliadoConId");

CREATE TABLE IF NOT EXISTS "movimientos_banco_reales" (
  "id"              TEXT NOT NULL,
  "fecha"           TIMESTAMP(3) NOT NULL,
  "monto"           DECIMAL(14,2) NOT NULL,
  "descripcion"     TEXT NOT NULL,
  "referenciaBanco" TEXT,
  "cargadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cargaId"         TEXT NOT NULL,
  CONSTRAINT "movimientos_banco_reales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "movimientos_banco_reales_fecha_monto_descripcion_key"
  ON "movimientos_banco_reales" ("fecha", "monto", "descripcion");
CREATE INDEX IF NOT EXISTS "movimientos_banco_reales_fecha_idx"
  ON "movimientos_banco_reales" ("fecha");
CREATE INDEX IF NOT EXISTS "movimientos_banco_reales_cargaId_idx"
  ON "movimientos_banco_reales" ("cargaId");

DO $$ BEGIN
  ALTER TABLE "movimientos_banco_esperados"
    ADD CONSTRAINT "movimientos_banco_esperados_asientoId_fkey"
    FOREIGN KEY ("asientoId") REFERENCES "asientos" ("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "movimientos_banco_esperados"
    ADD CONSTRAINT "movimientos_banco_esperados_conciliadoConId_fkey"
    FOREIGN KEY ("conciliadoConId") REFERENCES "movimientos_banco_reales" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "cargas_extracto_banco" (
  "id"               TEXT NOT NULL,
  "cargadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivoNombre"    TEXT NOT NULL,
  "filasTotales"     INTEGER NOT NULL,
  "filasInsertadas"  INTEGER NOT NULL,
  "filasDuplicadas"  INTEGER NOT NULL,
  "filasError"       INTEGER NOT NULL,
  "rangoFechaInicio" TIMESTAMP(3) NOT NULL,
  "rangoFechaFin"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cargas_extracto_banco_pkey" PRIMARY KEY ("id")
);

-- Auditoría contable (Job I)

CREATE TABLE IF NOT EXISTS "auditoria_contable_logs" (
  "id"             TEXT NOT NULL,
  "fechaIntento"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ok"             BOOLEAN NOT NULL,
  "totalHallazgos" INTEGER NOT NULL,
  "errores"        INTEGER NOT NULL,
  "warns"          INTEGER NOT NULL,
  "resumen"        JSONB NOT NULL,
  CONSTRAINT "auditoria_contable_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auditoria_contable_logs_fechaIntento_idx"
  ON "auditoria_contable_logs" ("fechaIntento");

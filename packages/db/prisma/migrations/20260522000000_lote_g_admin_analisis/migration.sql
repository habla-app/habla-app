-- Lote G — Admin desktop análisis (May 2026)
--
-- Migración aditiva pura. Crea 6 modelos para alimentar las vistas
-- /admin/{kpis, cohortes, mobile-vitals, finanzas, alarmas} + 2 enums.
-- Sin renombres ni cambios de tipo: NO requiere backup pre-deploy.

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE "TipoAlarma" AS ENUM ('KPI_THRESHOLD', 'EVENTO_CRITICO', 'MANUAL');
CREATE TYPE "SeveridadAlarma" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- ============================================================
-- metricas_vitales — Core Web Vitals reales (sample 10% en cliente)
-- ============================================================
CREATE TABLE "metricas_vitales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "ruta" TEXT NOT NULL,
    "deviceType" TEXT,
    "connectionType" TEXT,
    "userAgent" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metricas_vitales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "metricas_vitales_nombre_fecha_idx" ON "metricas_vitales"("nombre", "fecha" DESC);
CREATE INDEX "metricas_vitales_ruta_nombre_fecha_idx" ON "metricas_vitales"("ruta", "nombre", "fecha" DESC);

-- ============================================================
-- lighthouse_runs — Histórico Lighthouse (cron semanal + manual)
-- ============================================================
CREATE TABLE "lighthouse_runs" (
    "id" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "performance" INTEGER NOT NULL,
    "accessibility" INTEGER NOT NULL,
    "bestPractices" INTEGER NOT NULL,
    "seo" INTEGER NOT NULL,
    "lcpMs" INTEGER,
    "inpMs" INTEGER,
    "cls" DOUBLE PRECISION,
    "origen" TEXT NOT NULL DEFAULT 'cron',
    "disparadoPor" TEXT,
    "notas" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lighthouse_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lighthouse_runs_ruta_device_fecha_idx" ON "lighthouse_runs"("ruta", "device", "fecha" DESC);
CREATE INDEX "lighthouse_runs_fecha_idx" ON "lighthouse_runs"("fecha" DESC);

-- ============================================================
-- costos_operativos — Costos editables del admin
-- ============================================================
CREATE TABLE "costos_operativos" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "notas" TEXT,
    "registradoPor" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costos_operativos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "costos_operativos_mes_categoria_key" ON "costos_operativos"("mes", "categoria");
CREATE INDEX "costos_operativos_mes_idx" ON "costos_operativos"("mes");

-- ============================================================
-- comisiones_afiliacion — Pagos de comisión que reportan las casas
-- ============================================================
CREATE TABLE "comisiones_afiliacion" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "afiliadoId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "ftdsContados" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "registradoPor" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comisiones_afiliacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comisiones_afiliacion_mes_afiliadoId_key" ON "comisiones_afiliacion"("mes", "afiliadoId");
CREATE INDEX "comisiones_afiliacion_mes_idx" ON "comisiones_afiliacion"("mes");
CREATE INDEX "comisiones_afiliacion_afiliadoId_mes_idx" ON "comisiones_afiliacion"("afiliadoId", "mes");

ALTER TABLE "comisiones_afiliacion"
ADD CONSTRAINT "comisiones_afiliacion_afiliadoId_fkey"
FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- alarmas — Alarmas activas y desactivadas
-- ============================================================
CREATE TABLE "alarmas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlarma" NOT NULL,
    "severidad" "SeveridadAlarma" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "metricId" TEXT,
    "contexto" JSONB,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "desactivadaEn" TIMESTAMP(3),
    "desactivadaPor" TEXT,
    "motivoDesactivacion" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alarmas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alarmas_activa_severidad_creadaEn_idx" ON "alarmas"("activa", "severidad", "creadaEn" DESC);
CREATE INDEX "alarmas_metricId_activa_idx" ON "alarmas"("metricId", "activa");

-- ============================================================
-- alarmas_config — Configuración de thresholds por KPI
-- ============================================================
CREATE TABLE "alarmas_config" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "thresholdMin" DOUBLE PRECISION,
    "thresholdMax" DOUBLE PRECISION,
    "duracionMinutos" INTEGER NOT NULL DEFAULT 60,
    "severidad" "SeveridadAlarma" NOT NULL DEFAULT 'WARNING',
    "habilitada" BOOLEAN NOT NULL DEFAULT true,
    "notasInternas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarmas_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alarmas_config_metricId_key" ON "alarmas_config"("metricId");
CREATE INDEX "alarmas_config_habilitada_metricId_idx" ON "alarmas_config"("habilitada", "metricId");

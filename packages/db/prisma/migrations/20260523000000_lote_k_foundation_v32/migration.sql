-- Lote K v3.2 — Foundation (May 2026)
--
-- Migración aditiva pura: 1 modelo nuevo + 1 enum nuevo + 1 enum nuevo +
-- 5 columnas distribuidas en modelos existentes + 1 unique constraint
-- adicional en `tickets`.
--
-- NO requiere backup pre-deploy: solo CREATE TABLE / ADD COLUMN / ADD
-- CONSTRAINT. Sin renombres ni cambios de tipo.
--
-- Decisiones cubiertas (ver docs/analisis-repo-vs-mockup-v3.2.md):
--   §1.1 + §1.2 — AnalisisPartido como objeto rico único, una sola
--                  plantilla con bloques condicionales.
--   §1.3 — yapeNumero en Usuario (capturado solo al ganar Top 10).
--   §4.1 — Filtro 1 (mostrarAlPublico) + Filtro 2 (elegibleLiga) en Partido.
--   §4.2 — visibilidadOverride en Partido (override de regla 7d).
--   §4.3 — promptVersion + inputsJSON obligatorios en AnalisisPartido.
--   §4.9.1 — Unique (usuarioId, torneoId) en Ticket: una combinada por
--             jugador por torneo (= por partido elegible).
--   §4.9.7 — numEdiciones en Ticket: contador para KPI.
--
-- IMPORTANTE: la unique constraint nueva (tickets_usuarioId_torneoId_key)
-- puede fallar si hay datos productivos con duplicados. Esto sería un bug
-- preexistente; el flow del producto siempre asumió "una combinada por
-- usuario por torneo" — el unique a nivel BD es para hacerlo cumplir
-- formalmente. Si la migración falla: revisar duplicados manualmente,
-- mergear o eliminar antes de re-aplicar.

-- ============================================================
-- Enums nuevos
-- ============================================================
CREATE TYPE "VisibilidadOverride" AS ENUM ('forzar_visible', 'forzar_oculto');

CREATE TYPE "EstadoAnalisis" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ARCHIVADO');

-- ============================================================
-- Partido — Filtros admin v3.2 + override visibilidad
-- ============================================================
ALTER TABLE "partidos" ADD COLUMN "mostrarAlPublico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "partidos" ADD COLUMN "elegibleLiga" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "partidos" ADD COLUMN "visibilidadOverride" "VisibilidadOverride";

-- ============================================================
-- Usuario — yapeNumero (decisión §1.3)
-- ============================================================
ALTER TABLE "usuarios" ADD COLUMN "yapeNumero" TEXT;

-- ============================================================
-- Ticket — numEdiciones + unique constraint (decisiones §4.9.1, §4.9.7)
-- ============================================================
ALTER TABLE "tickets" ADD COLUMN "numEdiciones" INTEGER NOT NULL DEFAULT 0;

-- Unique constraint formal: una combinada por jugador por torneo.
-- En v3.2 cada Torneo representa exactamente un Partido elegible de la
-- Liga Habla! del mes, por lo que (usuarioId, torneoId) implica el
-- "uno por partido" del mockup.
CREATE UNIQUE INDEX "tickets_usuarioId_torneoId_key" ON "tickets"("usuarioId", "torneoId");

-- ============================================================
-- AnalisisPartido — objeto rico del motor v3.2
-- ============================================================
CREATE TABLE "analisis_partido" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "pronostico1x2" TEXT NOT NULL,
    "probabilidades" JSONB NOT NULL,
    "mejorCuota" JSONB NOT NULL,
    "analisisBasico" TEXT NOT NULL,
    "combinadaOptima" JSONB,
    "razonamiento" TEXT,
    "analisisGoles" JSONB,
    "analisisTarjetas" JSONB,
    "mercadosSecundarios" JSONB,
    "estado" "EstadoAnalisis" NOT NULL DEFAULT 'PENDIENTE',
    "promptVersion" TEXT NOT NULL,
    "inputsJSON" JSONB NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPor" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "rechazadoMotivo" TEXT,
    "archivadoEn" TIMESTAMP(3),
    "latenciaMs" INTEGER,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analisis_partido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analisis_partido_partidoId_key" ON "analisis_partido"("partidoId");
CREATE INDEX "analisis_partido_estado_idx" ON "analisis_partido"("estado");
CREATE INDEX "analisis_partido_generadoEn_idx" ON "analisis_partido"("generadoEn" DESC);

ALTER TABLE "analisis_partido"
    ADD CONSTRAINT "analisis_partido_partidoId_fkey"
    FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Lote V — Motor de captura de cuotas (May 2026)
--
-- Migración aditiva pura: 5 modelos nuevos + 2 columnas en `partidos`.
-- Todas las operaciones son CREATE TABLE / ALTER TABLE ADD COLUMN /
-- CREATE INDEX. Sin renombres, sin cambios de tipo, sin drops.
--
-- NO requiere backup pre-deploy (regla 2 del CLAUDE.md).
--
-- Seeds idempotentes al final:
--   - 7 filas en `salud_scrapers` (una por casa, estado SANO).
--   - 18 filas en `alias_equipos` (una por equipo de Liga 1 con su nombre
--     canónico apuntando a sí mismo). Los aliases por casa se irán
--     poblando según necesidad desde la vista admin del Lote V.
--
-- Decisiones documentadas (ver docs/plan-tecnico-lote-v-motor-cuotas.md):
--   §3.1 — CuotasCasa con 4 mercados (1X2, Doble Op, ±2.5, BTTS) +
--           cuota anterior por selección para detectar variaciones ≥5%.
--   §3.2 — partidos.estadoCaptura (string libre, no enum) + ultimaCapturaEn.
--   §3.3 — EventIdExterno con metodoDiscovery (AUTOMATICO | MANUAL).
--   §3.4 — AliasEquipo con equipoCanonicoNombre como string (no FK a un
--           modelo Equipo inexistente — desviación documentada en
--           schema.prisma).
--   §3.5 — AlertaCuota con vistaPorAdmin para flujo de revisión.
--   §3.6 — SaludScraper con diasConsecutivosError para auto-bloquear
--           cuando una casa lleva 3 días seguidos fallando.
--
-- ============================================================
-- Partido — estado del pipeline de captura por partido
-- ============================================================
ALTER TABLE "partidos" ADD COLUMN "estadoCaptura" TEXT NOT NULL DEFAULT 'INACTIVA';
ALTER TABLE "partidos" ADD COLUMN "ultimaCapturaEn" TIMESTAMP(3);

-- ============================================================
-- CuotasCasa — una fila por (partido, casa) con los 4 mercados
-- ============================================================
CREATE TABLE "cuotas_casa" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "eventIdExterno" TEXT NOT NULL,

    "cuotaLocal" DECIMAL(7,3),
    "cuotaLocalAnterior" DECIMAL(7,3),
    "cuotaEmpate" DECIMAL(7,3),
    "cuotaEmpateAnterior" DECIMAL(7,3),
    "cuotaVisita" DECIMAL(7,3),
    "cuotaVisitaAnterior" DECIMAL(7,3),

    "cuota1X" DECIMAL(7,3),
    "cuota1XAnterior" DECIMAL(7,3),
    "cuota12" DECIMAL(7,3),
    "cuota12Anterior" DECIMAL(7,3),
    "cuotaX2" DECIMAL(7,3),
    "cuotaX2Anterior" DECIMAL(7,3),

    "cuotaOver25" DECIMAL(7,3),
    "cuotaOver25Anterior" DECIMAL(7,3),
    "cuotaUnder25" DECIMAL(7,3),
    "cuotaUnder25Anterior" DECIMAL(7,3),

    "cuotaBttsSi" DECIMAL(7,3),
    "cuotaBttsSiAnterior" DECIMAL(7,3),
    "cuotaBttsNo" DECIMAL(7,3),
    "cuotaBttsNoAnterior" DECIMAL(7,3),

    "estado" TEXT NOT NULL,
    "ultimoIntento" TIMESTAMP(3) NOT NULL,
    "ultimoExito" TIMESTAMP(3),
    "errorMensaje" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,

    "capturadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuotas_casa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cuotas_casa_partidoId_casa_key" ON "cuotas_casa"("partidoId", "casa");
CREATE INDEX "cuotas_casa_partidoId_idx" ON "cuotas_casa"("partidoId");
CREATE INDEX "cuotas_casa_casa_estado_idx" ON "cuotas_casa"("casa", "estado");

ALTER TABLE "cuotas_casa"
    ADD CONSTRAINT "cuotas_casa_partidoId_fkey"
    FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- EventIdExterno — IDs de partido por casa (auto o manual)
-- ============================================================
CREATE TABLE "event_ids_externos" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "eventIdExterno" TEXT NOT NULL,
    "metodoDiscovery" TEXT NOT NULL,
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_ids_externos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_ids_externos_partidoId_casa_key" ON "event_ids_externos"("partidoId", "casa");
CREATE INDEX "event_ids_externos_partidoId_idx" ON "event_ids_externos"("partidoId");

ALTER TABLE "event_ids_externos"
    ADD CONSTRAINT "event_ids_externos_partidoId_fkey"
    FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- AliasEquipo — diccionario alias → nombre canónico
-- ============================================================
CREATE TABLE "alias_equipos" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "casa" TEXT,
    "equipoCanonicoNombre" TEXT NOT NULL,

    CONSTRAINT "alias_equipos_pkey" PRIMARY KEY ("id")
);

-- Unique parcial: cuando casa IS NULL la unicidad se evalúa sólo sobre
-- alias. Postgres permite múltiples NULL en un UNIQUE compuesto, así que
-- agregamos un índice parcial extra para el caso casa NULL.
CREATE UNIQUE INDEX "alias_equipos_alias_casa_key" ON "alias_equipos"("alias", "casa");
CREATE UNIQUE INDEX "alias_equipos_alias_global_key" ON "alias_equipos"("alias") WHERE "casa" IS NULL;
CREATE INDEX "alias_equipos_alias_idx" ON "alias_equipos"("alias");
CREATE INDEX "alias_equipos_equipoCanonicoNombre_idx" ON "alias_equipos"("equipoCanonicoNombre");

-- ============================================================
-- AlertaCuota — variaciones ≥5% para revisar en admin
-- ============================================================
CREATE TABLE "alertas_cuota" (
    "id" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "mercado" TEXT NOT NULL,
    "seleccion" TEXT NOT NULL,
    "cuotaAnterior" DECIMAL(7,3) NOT NULL,
    "cuotaNueva" DECIMAL(7,3) NOT NULL,
    "variacionPct" DECIMAL(7,3) NOT NULL,
    "vistaPorAdmin" BOOLEAN NOT NULL DEFAULT false,
    "detectadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_cuota_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alertas_cuota_partidoId_vistaPorAdmin_idx" ON "alertas_cuota"("partidoId", "vistaPorAdmin");
CREATE INDEX "alertas_cuota_detectadoEn_idx" ON "alertas_cuota"("detectadoEn");

ALTER TABLE "alertas_cuota"
    ADD CONSTRAINT "alertas_cuota_partidoId_fkey"
    FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- SaludScraper — estado por casa (SANO | DEGRADADO | BLOQUEADO)
-- ============================================================
CREATE TABLE "salud_scrapers" (
    "id" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "ultimaEjecucion" TIMESTAMP(3),
    "ultimoExito" TIMESTAMP(3),
    "diasConsecutivosError" INTEGER NOT NULL DEFAULT 0,
    "detalleError" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salud_scrapers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salud_scrapers_casa_key" ON "salud_scrapers"("casa");

-- ============================================================
-- Seed — 7 casas en estado SANO
-- ============================================================
-- Idempotente: ON CONFLICT DO NOTHING permite re-aplicar sin duplicar.
-- IDs determinísticos para que el row sea fácilmente referenciable.
INSERT INTO "salud_scrapers" ("id", "casa", "estado", "diasConsecutivosError", "actualizadoEn")
VALUES
  ('saludv-stake',         'stake',         'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-apuesta-total', 'apuesta_total', 'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-coolbet',       'coolbet',       'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-doradobet',     'doradobet',     'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-betano',        'betano',        'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-inkabet',       'inkabet',       'SANO', 0, CURRENT_TIMESTAMP),
  ('saludv-te-apuesto',    'te_apuesto',    'SANO', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("casa") DO NOTHING;

-- ============================================================
-- Seed — 18 equipos de Liga 1 Perú (alias = nombre canónico)
-- ============================================================
-- Lista oficial Liga 1 2026. El alias inicial es el propio nombre canónico
-- (casa=NULL → aplica a todas las casas) para que el matcher funcione cuando
-- los scrapers devuelven el nombre exacto. Los aliases por casa específica
-- se agregan en V.5 a partir del QA real.
INSERT INTO "alias_equipos" ("id", "alias", "casa", "equipoCanonicoNombre")
VALUES
  ('aliasv-alianza-lima',         'Alianza Lima',         NULL, 'Alianza Lima'),
  ('aliasv-universitario',        'Universitario',        NULL, 'Universitario'),
  ('aliasv-sporting-cristal',     'Sporting Cristal',     NULL, 'Sporting Cristal'),
  ('aliasv-cienciano',            'Cienciano',            NULL, 'Cienciano'),
  ('aliasv-melgar',               'FBC Melgar',           NULL, 'FBC Melgar'),
  ('aliasv-csd-municipal',        'Deportivo Municipal',  NULL, 'Deportivo Municipal'),
  ('aliasv-cesar-vallejo',        'César Vallejo',        NULL, 'César Vallejo'),
  ('aliasv-alianza-atletico',     'Alianza Atlético',     NULL, 'Alianza Atlético'),
  ('aliasv-alianza-uni-vh',       'Alianza Universidad',  NULL, 'Alianza Universidad'),
  ('aliasv-comerciantes-uni',     'Comerciantes Unidos',  NULL, 'Comerciantes Unidos'),
  ('aliasv-juan-pablo-ii',        'Juan Pablo II College',NULL, 'Juan Pablo II College'),
  ('aliasv-cusco-fc',             'Cusco FC',             NULL, 'Cusco FC'),
  ('aliasv-utc',                  'UTC Cajamarca',        NULL, 'UTC Cajamarca'),
  ('aliasv-deportivo-garcilaso',  'Deportivo Garcilaso',  NULL, 'Deportivo Garcilaso'),
  ('aliasv-sport-boys',           'Sport Boys',           NULL, 'Sport Boys'),
  ('aliasv-sport-huancayo',       'Sport Huancayo',       NULL, 'Sport Huancayo'),
  ('aliasv-atletico-grau',        'Atlético Grau',        NULL, 'Atlético Grau'),
  ('aliasv-los-chankas',          'Los Chankas',          NULL, 'Los Chankas')
ON CONFLICT ("alias") WHERE "casa" IS NULL DO NOTHING;

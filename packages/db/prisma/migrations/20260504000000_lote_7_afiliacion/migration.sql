-- Lote 7 (May 2026): infraestructura de afiliación MINCETUR.
--
-- Plataforma editorial + comunidad gratuita + monetización por afiliación
-- a casas de apuestas autorizadas por MINCETUR. Esta migración construye
-- la base de datos: catálogo de operadores, tracking de clicks (con IP
-- hasheada — IP cruda nunca se persiste), y registro manual de conversiones
-- reportadas por las casas.
--
-- Migración no destructiva — aditiva pura:
--   3 CREATE TABLE + 1 UNIQUE INDEX + 2 INDEX + 5 FOREIGN KEY.
-- No requiere backup pre-deploy según la regla del proyecto (sólo
-- migraciones que comprometen integridad —renombres, cambios de tipo,
-- conversiones, FKs movidas— exigen backup).
--
-- Tablas nuevas:
--   - afiliados              catálogo de operadores con bonos / rating / etc.
--   - clicks_afiliados       1 fila por GET /go/[slug]
--   - conversiones_afiliados registro manual de REGISTRO/FTD por afiliado

-- ---------------------------------------------------------------------------
-- (1) afiliados — catálogo de operadores
-- ---------------------------------------------------------------------------

CREATE TABLE "afiliados" (
  "id"                         TEXT NOT NULL,
  "slug"                       TEXT NOT NULL,
  "nombre"                     TEXT NOT NULL,
  "logoUrl"                    TEXT,
  "autorizadoMincetur"         BOOLEAN NOT NULL DEFAULT true,
  "urlBase"                    TEXT NOT NULL,
  "modeloComision"             TEXT NOT NULL,
  "montoCpa"                   INTEGER,
  "porcentajeRevshare"         DECIMAL(5,2),
  "bonoActual"                 TEXT,
  "metodosPago"                TEXT[],
  "pros"                       JSONB,
  "contras"                    JSONB,
  "rating"                     DECIMAL(3,2),
  "activo"                     BOOLEAN NOT NULL DEFAULT true,
  "ordenDestacado"             INTEGER NOT NULL DEFAULT 100,
  "ultimaVerificacionMincetur" TIMESTAMP(3),
  "creadoEn"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "afiliados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "afiliados_slug_key" ON "afiliados"("slug");

-- ---------------------------------------------------------------------------
-- (2) clicks_afiliados — 1 fila por GET /go/[slug]
-- ---------------------------------------------------------------------------

CREATE TABLE "clicks_afiliados" (
  "id"         TEXT NOT NULL,
  "afiliadoId" TEXT NOT NULL,
  "userId"     TEXT,
  "pagina"     TEXT NOT NULL,
  "utm"        JSONB,
  "ipHash"     TEXT NOT NULL,
  "userAgent"  TEXT,
  "pais"       TEXT,
  "creadoEn"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clicks_afiliados_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "clicks_afiliados"
  ADD CONSTRAINT "clicks_afiliados_afiliadoId_fkey"
  FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clicks_afiliados"
  ADD CONSTRAINT "clicks_afiliados_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "clicks_afiliados_afiliadoId_creadoEn_idx"
  ON "clicks_afiliados"("afiliadoId", "creadoEn" DESC);

-- ---------------------------------------------------------------------------
-- (3) conversiones_afiliados — REGISTRO/FTD reportados por la casa
-- ---------------------------------------------------------------------------

CREATE TABLE "conversiones_afiliados" (
  "id"            TEXT NOT NULL,
  "afiliadoId"    TEXT NOT NULL,
  "userId"        TEXT,
  "tipo"          TEXT NOT NULL,
  "montoComision" DECIMAL(10,2),
  "reportadoEn"   TIMESTAMP(3) NOT NULL,
  "notas"         TEXT,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversiones_afiliados_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversiones_afiliados"
  ADD CONSTRAINT "conversiones_afiliados_afiliadoId_fkey"
  FOREIGN KEY ("afiliadoId") REFERENCES "afiliados"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversiones_afiliados"
  ADD CONSTRAINT "conversiones_afiliados_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "conversiones_afiliados_afiliadoId_reportadoEn_idx"
  ON "conversiones_afiliados"("afiliadoId", "reportadoEn" DESC);

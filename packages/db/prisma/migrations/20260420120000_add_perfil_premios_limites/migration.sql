-- Sub-Sprints 6 y 7: tienda + canjes + perfil + verificación + límites.
--
-- Agrega:
--  (a) Campos a `usuarios` para Sub-Sprint 7 (username, telefonoVerif, dniVerif, ubicacion, deletedAt).
--  (b) Extensión de `premios` (categoria, badge, featured, requiereDireccion, valorSoles).
--  (c) Enums CategoriaPremio, BadgePremio, EstadoVerifDni.
--  (d) Tablas: preferencias_notif, limites_juego, verificacion_telefono, verificacion_dni, solicitudes_eliminacion.
--
-- Idempotente vía `IF NOT EXISTS` donde aplica (Postgres). Nombre de migración
-- con prefijo de fecha YYYYMMDDHHMMSS para ordenamiento estable.

-- ============================================================
-- (a) Extensión de `usuarios`
-- ============================================================
ALTER TABLE "usuarios"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "telefonoVerif" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dniVerif" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ubicacion" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- ============================================================
-- (b) Extensión de `premios`
-- ============================================================
CREATE TYPE "CategoriaPremio" AS ENUM ('ENTRADA', 'CAMISETA', 'GIFT', 'TECH', 'EXPERIENCIA');
CREATE TYPE "BadgePremio" AS ENUM ('POPULAR', 'NUEVO', 'LIMITADO');

ALTER TABLE "premios"
  ADD COLUMN "categoria" "CategoriaPremio" NOT NULL DEFAULT 'GIFT',
  ADD COLUMN "badge" "BadgePremio",
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiereDireccion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "valorSoles" INTEGER;

CREATE INDEX "premios_activo_categoria_idx" ON "premios"("activo", "categoria");

-- ============================================================
-- (c) Enum EstadoVerifDni
-- ============================================================
CREATE TYPE "EstadoVerifDni" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- ============================================================
-- (d) Tablas nuevas de Sub-Sprint 7
-- ============================================================

-- Preferencias de notificación (7 toggles)
CREATE TABLE "preferencias_notif" (
  "usuarioId"         TEXT NOT NULL,
  "notifInicioTorneo" BOOLEAN NOT NULL DEFAULT true,
  "notifResultados"   BOOLEAN NOT NULL DEFAULT true,
  "notifPremios"      BOOLEAN NOT NULL DEFAULT true,
  "notifSugerencias"  BOOLEAN NOT NULL DEFAULT true,
  "notifCierreTorneo" BOOLEAN NOT NULL DEFAULT true,
  "notifPromos"       BOOLEAN NOT NULL DEFAULT false,
  "emailSemanal"      BOOLEAN NOT NULL DEFAULT false,
  "actualizadoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "preferencias_notif_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "preferencias_notif_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Límites de juego responsable
CREATE TABLE "limites_juego" (
  "usuarioId"           TEXT NOT NULL,
  "limiteMensualCompra" INTEGER NOT NULL DEFAULT 300,
  "limiteDiarioTickets" INTEGER NOT NULL DEFAULT 10,
  "autoExclusionHasta"  TIMESTAMP(3),
  "actualizadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "limites_juego_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "limites_juego_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Verificación de teléfono (código TTL 10 min, max 3 intentos)
CREATE TABLE "verificacion_telefono" (
  "usuarioId"  TEXT NOT NULL,
  "telefono"   TEXT NOT NULL,
  "codigo"     TEXT NOT NULL,
  "intentos"   INTEGER NOT NULL DEFAULT 0,
  "expiraEn"   TIMESTAMP(3) NOT NULL,
  "creadoEn"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmado" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "verificacion_telefono_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "verificacion_telefono_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Verificación de DNI (imagen + revisión manual admin)
CREATE TABLE "verificacion_dni" (
  "id"            TEXT NOT NULL,
  "usuarioId"     TEXT NOT NULL,
  "dniNumero"     TEXT NOT NULL,
  "imagenUrl"     TEXT NOT NULL,
  "estado"        "EstadoVerifDni" NOT NULL DEFAULT 'PENDIENTE',
  "motivoRechazo" TEXT,
  "revisadoEn"    TIMESTAMP(3),
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "verificacion_dni_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verificacion_dni_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "verificacion_dni_usuarioId_key" ON "verificacion_dni"("usuarioId");

-- Solicitudes de eliminación de cuenta (token + TTL 48h)
CREATE TABLE "solicitudes_eliminacion" (
  "id"           TEXT NOT NULL,
  "usuarioId"    TEXT NOT NULL,
  "token"        TEXT NOT NULL,
  "expiraEn"     TIMESTAMP(3) NOT NULL,
  "confirmadaEn" TIMESTAMP(3),
  "creadoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "solicitudes_eliminacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "solicitudes_eliminacion_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "solicitudes_eliminacion_token_key" ON "solicitudes_eliminacion"("token");

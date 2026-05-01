-- Lote E (May 2026) — Premium WhatsApp Channel backend.
--
-- Modelo de Premium v3.1: suscripción con entrega vía WhatsApp Channel
-- privado + bot 1:1 vía WhatsApp Business API. Pasarela de pagos: OpenPay
-- BBVA. Generación de picks asistida por Claude API con aprobación humana
-- obligatoria del editor antes de salir al Channel.
--
-- 1. ALTER usuarios       → agregar `telefono` (nullable). E.164 capturado
--                           en checkout para envío 1:1 vía bot WhatsApp.
-- 2. ALTER preferencias_notif → agregar toggles `notifPremiumPicks` y
--                           `notifPremiumAlertasVivo` (default TRUE).
-- 3. CREATE suscripciones      → 1 fila por suscripción. Indices por
--                           (usuarioId, activa) y (proximoCobro).
-- 4. CREATE pagos_suscripcion  → histórico de cobros. UNIQUE(openpayCobroId)
--                           para idempotencia del webhook OpenPay.
-- 5. CREATE miembros_channel   → espejo de membresía en WhatsApp Channel.
--                           UNIQUE(suscripcionId, estado): 1 fila activa
--                           por suscripción por estado.
-- 6. CREATE picks_premium      → picks generados por Claude API + aprobados
--                           por editor antes de publicación.
-- 7. CREATE conversaciones_bot + mensajes_bot → bot FAQ 1:1 con Claude API.
-- 8. CREATE 9 enums            → PlanPremium, EstadoSuscripcion, EstadoPago,
--                           EstadoMembresia, MercadoPick, FuentePick,
--                           EstadoPick, ResultadoPick, RolMensaje.
--
-- Aditiva pura. No requiere backup pre-deploy (regla 2 de CLAUDE.md):
-- todos los CREATE TABLE / ADD COLUMN no comprometen integridad de Postgres.

-- ---------------------------------------------------------------------------
-- 1. usuarios — agregar telefono
-- ---------------------------------------------------------------------------

ALTER TABLE "usuarios"
  ADD COLUMN "telefono" TEXT;

-- ---------------------------------------------------------------------------
-- 2. preferencias_notif — agregar toggles Premium
-- ---------------------------------------------------------------------------

ALTER TABLE "preferencias_notif"
  ADD COLUMN "notifPremiumPicks"       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "notifPremiumAlertasVivo" BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 3-8. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "PlanPremium" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'ANUAL');

CREATE TYPE "EstadoSuscripcion" AS ENUM (
  'PENDIENTE', 'ACTIVA', 'CANCELANDO', 'VENCIDA', 'REEMBOLSADA', 'FALLIDA'
);

CREATE TYPE "EstadoPago" AS ENUM (
  'PENDIENTE', 'PAGADO', 'RECHAZADO', 'REEMBOLSADO', 'TIMEOUT'
);

CREATE TYPE "EstadoMembresia" AS ENUM (
  'INVITADO', 'UNIDO', 'REINVITADO', 'REMOVIDO'
);

CREATE TYPE "MercadoPick" AS ENUM (
  'RESULTADO_1X2', 'BTTS', 'OVER_UNDER_25', 'TARJETA_ROJA', 'MARCADOR_EXACTO'
);

CREATE TYPE "FuentePick" AS ENUM ('CLAUDE_API', 'EDITOR_MANUAL');

CREATE TYPE "EstadoPick" AS ENUM (
  'PENDIENTE', 'APROBADO', 'EDITADO_Y_APROBADO', 'RECHAZADO'
);

CREATE TYPE "ResultadoPick" AS ENUM ('GANADO', 'PERDIDO', 'NULO', 'PUSH');

CREATE TYPE "RolMensaje" AS ENUM ('USER', 'ASSISTANT');

-- ---------------------------------------------------------------------------
-- 3. suscripciones
-- ---------------------------------------------------------------------------

CREATE TABLE "suscripciones" (
  "id"                    TEXT NOT NULL,
  "usuarioId"             TEXT NOT NULL,
  "plan"                  "PlanPremium" NOT NULL,
  "precio"                INTEGER NOT NULL,
  "openpaySuscripcionId"  TEXT,
  "openpayCustomerId"     TEXT,
  "estado"                "EstadoSuscripcion" NOT NULL DEFAULT 'PENDIENTE',
  "activa"                BOOLEAN NOT NULL DEFAULT FALSE,
  "cancelada"             BOOLEAN NOT NULL DEFAULT FALSE,
  "iniciada"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proximoCobro"          TIMESTAMP(3),
  "vencimiento"           TIMESTAMP(3),
  "canceladaEn"           TIMESTAMP(3),
  "motivoCancela"         TEXT,
  "enGarantia"            BOOLEAN NOT NULL DEFAULT TRUE,
  "reembolsoPedido"       BOOLEAN NOT NULL DEFAULT FALSE,
  "reembolsoEn"           TIMESTAMP(3),
  "creadoEn"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suscripciones_openpaySuscripcionId_key"
  ON "suscripciones"("openpaySuscripcionId");

CREATE INDEX "suscripciones_usuarioId_activa_idx"
  ON "suscripciones"("usuarioId", "activa");

CREATE INDEX "suscripciones_proximoCobro_idx"
  ON "suscripciones"("proximoCobro");

CREATE INDEX "suscripciones_estado_vencimiento_idx"
  ON "suscripciones"("estado", "vencimiento");

ALTER TABLE "suscripciones"
  ADD CONSTRAINT "suscripciones_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. pagos_suscripcion
-- ---------------------------------------------------------------------------

CREATE TABLE "pagos_suscripcion" (
  "id"             TEXT NOT NULL,
  "suscripcionId"  TEXT NOT NULL,
  "openpayCobroId" TEXT NOT NULL,
  "openpayMetodo"  TEXT,
  "monto"          INTEGER NOT NULL,
  "estado"         "EstadoPago" NOT NULL,
  "intentos"       INTEGER NOT NULL DEFAULT 1,
  "fecha"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acreditadoEn"   TIMESTAMP(3),
  "rechazadoEn"    TIMESTAMP(3),
  "ultimosCuatro"  TEXT,
  "marcaTarjeta"   TEXT,
  "codigoError"    TEXT,
  "mensajeError"   TEXT,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pagos_suscripcion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pagos_suscripcion_openpayCobroId_key"
  ON "pagos_suscripcion"("openpayCobroId");

CREATE INDEX "pagos_suscripcion_suscripcionId_fecha_idx"
  ON "pagos_suscripcion"("suscripcionId", "fecha" DESC);

ALTER TABLE "pagos_suscripcion"
  ADD CONSTRAINT "pagos_suscripcion_suscripcionId_fkey"
  FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. miembros_channel
-- ---------------------------------------------------------------------------

CREATE TABLE "miembros_channel" (
  "id"              TEXT NOT NULL,
  "suscripcionId"   TEXT NOT NULL,
  "usuarioId"       TEXT NOT NULL,
  "estado"          "EstadoMembresia" NOT NULL DEFAULT 'INVITADO',
  "invitadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unidoEn"         TIMESTAMP(3),
  "removidoEn"      TIMESTAMP(3),
  "invitesEnviados" INTEGER NOT NULL DEFAULT 1,
  "ultimoInviteAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "miembros_channel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "miembros_channel_suscripcionId_estado_key"
  ON "miembros_channel"("suscripcionId", "estado");

CREATE INDEX "miembros_channel_usuarioId_estado_idx"
  ON "miembros_channel"("usuarioId", "estado");

ALTER TABLE "miembros_channel"
  ADD CONSTRAINT "miembros_channel_suscripcionId_fkey"
  FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. picks_premium
-- ---------------------------------------------------------------------------

CREATE TABLE "picks_premium" (
  "id"                TEXT NOT NULL,
  "partidoId"         TEXT NOT NULL,
  "mercado"           "MercadoPick" NOT NULL,
  "outcome"           TEXT NOT NULL,
  "cuotaSugerida"     DOUBLE PRECISION NOT NULL,
  "stakeSugerido"     DOUBLE PRECISION NOT NULL,
  "evPctSugerido"     DOUBLE PRECISION,
  "casaRecomendadaId" TEXT,
  "razonamiento"      TEXT NOT NULL,
  "estadisticas"      JSONB,
  "generadoPor"       "FuentePick" NOT NULL,
  "generadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estado"            "EstadoPick" NOT NULL DEFAULT 'PENDIENTE',
  "aprobado"          BOOLEAN NOT NULL DEFAULT FALSE,
  "aprobadoPor"       TEXT,
  "aprobadoEn"        TIMESTAMP(3),
  "rechazadoMotivo"   TEXT,
  "enviadoAlChannel"  BOOLEAN NOT NULL DEFAULT FALSE,
  "enviadoEn"         TIMESTAMP(3),
  "channelMessageId"  TEXT,
  "resultadoFinal"    "ResultadoPick",
  "evaluadoEn"        TIMESTAMP(3),
  "fechaPublicacion"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoEn"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "picks_premium_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "picks_premium_partidoId_aprobado_idx"
  ON "picks_premium"("partidoId", "aprobado");

CREATE INDEX "picks_premium_estado_fechaPublicacion_idx"
  ON "picks_premium"("estado", "fechaPublicacion" DESC);

CREATE INDEX "picks_premium_aprobado_resultadoFinal_idx"
  ON "picks_premium"("aprobado", "resultadoFinal");

ALTER TABLE "picks_premium"
  ADD CONSTRAINT "picks_premium_partidoId_fkey"
  FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "picks_premium"
  ADD CONSTRAINT "picks_premium_casaRecomendadaId_fkey"
  FOREIGN KEY ("casaRecomendadaId") REFERENCES "afiliados"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. conversaciones_bot
-- ---------------------------------------------------------------------------

CREATE TABLE "conversaciones_bot" (
  "id"              TEXT NOT NULL,
  "usuarioId"       TEXT,
  "whatsappFrom"    TEXT NOT NULL,
  "ultimoMensajeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cerrada"         BOOLEAN NOT NULL DEFAULT FALSE,
  "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversaciones_bot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversaciones_bot_whatsappFrom_cerrada_idx"
  ON "conversaciones_bot"("whatsappFrom", "cerrada");

CREATE INDEX "conversaciones_bot_usuarioId_cerrada_idx"
  ON "conversaciones_bot"("usuarioId", "cerrada");

ALTER TABLE "conversaciones_bot"
  ADD CONSTRAINT "conversaciones_bot_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 8. mensajes_bot
-- ---------------------------------------------------------------------------

CREATE TABLE "mensajes_bot" (
  "id"             TEXT NOT NULL,
  "conversacionId" TEXT NOT NULL,
  "rol"            "RolMensaje" NOT NULL,
  "contenido"      TEXT NOT NULL,
  "whatsappMsgId"  TEXT,
  "generadoConIA"  BOOLEAN NOT NULL DEFAULT FALSE,
  "modeloIA"       TEXT,
  "tokensUsados"   INTEGER,
  "fueDerivado"    BOOLEAN NOT NULL DEFAULT FALSE,
  "creadoEn"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mensajes_bot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mensajes_bot_conversacionId_creadoEn_idx"
  ON "mensajes_bot"("conversacionId", "creadoEn");

ALTER TABLE "mensajes_bot"
  ADD CONSTRAINT "mensajes_bot_conversacionId_fkey"
  FOREIGN KEY ("conversacionId") REFERENCES "conversaciones_bot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

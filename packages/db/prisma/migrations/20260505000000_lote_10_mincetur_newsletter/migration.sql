-- Lote 10 (May 2026) — Verificación MINCETUR weekly + newsletter automation.
--
-- 1. ALTER preferencias_notif → agregar `notifSemanal` (default true). El
--    digest semanal del Lote 10 es opt-out: los usuarios actuales reciben
--    el resumen por default y pueden optar out desde /perfil/preferencias.
--    El `emailSemanal` legacy queda como columna deprecada (default false,
--    no usada por callers a partir de este lote).
--
-- 2. ALTER afiliados → agregar `verificacionPendiente` (default false). El
--    cron K lo setea a true cuando no pudo verificar al afiliado contra el
--    registro MINCETUR (red caída, DOM cambió, fetch falló) y NO modifica
--    `autorizadoMincetur`/`activo`. El admin lo resuelve manualmente desde
--    /admin/afiliados/[id].
--
-- 3. CREATE suscriptores_newsletter — emails externos suscritos al digest
--    editorial. Flujo doble opt-in (token magic link). UNIQUE(email).
--
-- 4. CREATE digests_enviados — 1 fila por semana ISO (YYYY-WW). El cron L
--    crea la fila los sábados con `enviadoEn=null` + `contenido` JSONB. El
--    admin aprueba desde /admin/newsletter; el endpoint admin marca
--    `enviadoEn` + `destinatarios` + `aprobadoPor`.

ALTER TABLE "preferencias_notif"
  ADD COLUMN "notifSemanal" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "afiliados"
  ADD COLUMN "verificacionPendiente" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "suscriptores_newsletter" (
  "id"              TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "confirmadoEn"    TIMESTAMP(3),
  "unsubscribedEn"  TIMESTAMP(3),
  "fuente"          TEXT,
  "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "suscriptores_newsletter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suscriptores_newsletter_email_key" ON "suscriptores_newsletter"("email");

CREATE TABLE "digests_enviados" (
  "id"            TEXT NOT NULL,
  "semana"        TEXT NOT NULL,
  "contenido"     JSONB NOT NULL,
  "destinatarios" INTEGER NOT NULL DEFAULT 0,
  "enviadoEn"     TIMESTAMP(3),
  "aprobadoPor"   TEXT,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "digests_enviados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "digests_enviados_semana_key" ON "digests_enviados"("semana");

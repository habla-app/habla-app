-- Lote 5 (May 2026): modelo de competencia mensual + premios en efectivo.
--
-- Reemplaza al sistema de premios por torneo (demolido en Lote 2 junto con
-- Lukas). Cada mes calendario forma un leaderboard que agrega
-- `puntosFinales` por usuario sobre tickets de torneos finalizados del mes
-- en curso. El día 1 del mes siguiente un cron cierra el leaderboard del
-- mes pasado y crea los registros de PremioMensual para el top 10
-- (S/ 1,250 totales: 1° S/ 500, 2° S/ 200, 3° S/ 200, 4°-10° S/ 50 c/u).
--
-- Migración no destructiva — todas las operaciones son aditivas:
--   2 CREATE TABLE + 1 ALTER ADD COLUMN + 1 UPDATE de backfill.
-- No requiere backup pre-deploy según la nueva regla del proyecto (sólo
-- migraciones que comprometen integridad —renombres, cambios de tipo,
-- conversiones, FKs movidas— exigen backup).
--
-- Tablas nuevas:
--   - leaderboards         (1 fila por mes calendario; mes UNIQUE)
--   - premios_mensuales    (top 10 del leaderboard, con estado de pago)
-- Columna nueva:
--   - tickets.puntosFinales (snapshot de puntosTotal al FT del torneo)

-- ---------------------------------------------------------------------------
-- (1) Leaderboard mensual
-- ---------------------------------------------------------------------------

CREATE TABLE "leaderboards" (
  "id"            TEXT NOT NULL,
  "mes"           TEXT NOT NULL,
  "cerradoEn"     TIMESTAMP(3),
  "posiciones"    JSONB,
  "totalUsuarios" INTEGER NOT NULL DEFAULT 0,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leaderboards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leaderboards_mes_key" ON "leaderboards"("mes");

-- ---------------------------------------------------------------------------
-- (2) Premios mensuales (1 row por puesto del top 10 al cierre)
-- ---------------------------------------------------------------------------

CREATE TABLE "premios_mensuales" (
  "id"            TEXT NOT NULL,
  "leaderboardId" TEXT NOT NULL,
  "posicion"      INTEGER NOT NULL,
  "userId"        TEXT NOT NULL,
  "montoSoles"    INTEGER NOT NULL,
  "estado"        TEXT NOT NULL DEFAULT 'PENDIENTE',
  "datosPago"     JSONB,
  "pagadoEn"      TIMESTAMP(3),
  "notas"         TEXT,
  "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "premios_mensuales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "premios_mensuales"
  ADD CONSTRAINT "premios_mensuales_leaderboardId_fkey"
  FOREIGN KEY ("leaderboardId") REFERENCES "leaderboards"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "premios_mensuales"
  ADD CONSTRAINT "premios_mensuales_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "premios_mensuales_leaderboardId_idx" ON "premios_mensuales"("leaderboardId");
CREATE INDEX "premios_mensuales_userId_idx"        ON "premios_mensuales"("userId");
CREATE INDEX "premios_mensuales_estado_idx"        ON "premios_mensuales"("estado");

-- ---------------------------------------------------------------------------
-- (3) tickets.puntosFinales — snapshot de puntos al cerrar el torneo.
--
-- Backfill: copiamos `puntosTotal` para tickets que ya tienen `posicionFinal`
-- (= participaron de un torneo finalizado). El campo queda NULL para
-- tickets de torneos en curso o ABIERTO; se completa cuando el torneo
-- finaliza. NOTA: la spec del lote pedía `UPDATE ... SET puntosFinales =
-- puntos`, pero la columna real del schema es `puntosTotal` — se usa esa.
-- ---------------------------------------------------------------------------

ALTER TABLE "tickets" ADD COLUMN "puntosFinales" INTEGER;

UPDATE "tickets" SET "puntosFinales" = "puntosTotal" WHERE "posicionFinal" IS NOT NULL;

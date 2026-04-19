-- Sub-Sprint 5: motor de puntuación + ranking en vivo.
--
-- Agrega la tabla `eventos_partido` para persistir cada gol, tarjeta, sustitución,
-- y fin de partido que llega del poller de api-football. El poller reemite cada
-- evento nuevo por Socket.io (room = torneoId) y dispara recálculo del ranking.
--
-- Clave natural del upsert idempotente (para que re-correr el poller no duplique):
--   (partidoId, tipo, minuto, equipo, jugador)
-- El `jugador` puede venir null para algunos eventos (FIN_PARTIDO, HALFTIME); lo
-- incluimos en la unique para diferenciar dos goles en el mismo minuto de dos
-- jugadores distintos.
CREATE TABLE "eventos_partido" (
  "id"         TEXT NOT NULL,
  "partidoId"  TEXT NOT NULL,
  "tipo"       TEXT NOT NULL,
  "minuto"     INTEGER NOT NULL,
  "equipo"     TEXT NOT NULL,
  "jugador"    TEXT,
  "detalle"    TEXT,
  "creadoEn"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "eventos_partido_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eventos_partido_partidoId_minuto_idx"
  ON "eventos_partido" ("partidoId", "minuto");

CREATE UNIQUE INDEX "eventos_partido_natural_key_idx"
  ON "eventos_partido" ("partidoId", "tipo", "minuto", "equipo", COALESCE("jugador", ''));

ALTER TABLE "eventos_partido"
  ADD CONSTRAINT "eventos_partido_partidoId_fkey"
  FOREIGN KEY ("partidoId") REFERENCES "partidos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

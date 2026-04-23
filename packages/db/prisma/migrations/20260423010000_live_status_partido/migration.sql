-- Persistencia del snapshot del minuto en vivo (Abr 2026).
--
-- Hasta ahora el poller escribía el estado en vivo (status.short, elapsed,
-- extra) SOLO a un Map in-memory dentro del proceso Node. Eso fallaba en
-- multi-réplica (réplica A popula su Map, la request del usuario aterriza
-- en réplica B → cache vacío → "—") y tras cualquier restart del proceso.
--
-- Columnas nuevas, todas nullable. No requiere backfill: el poller las
-- popula en el próximo tick (≤30s después del deploy).

ALTER TABLE "partidos"
  ADD COLUMN "liveStatusShort" TEXT,
  ADD COLUMN "liveElapsed" INTEGER,
  ADD COLUMN "liveExtra" INTEGER,
  ADD COLUMN "liveUpdatedAt" TIMESTAMP(3);

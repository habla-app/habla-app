-- Fase 3: agrega `round` y `venue` al Partido para enriquecer la UI de
-- /matches. Ambas columnas son nullable: los partidos previos al deploy
-- quedan con NULL hasta la siguiente corrida del auto-import (cada 6h),
-- que las rellena desde api-football.
ALTER TABLE "partidos"
  ADD COLUMN "round" TEXT,
  ADD COLUMN "venue" TEXT;

-- Registro formal (Abr 2026): `username` pasa a NOT NULL + unique.
--
-- Estrategia de reset acordada: la BD se dropea y remigra desde cero, así
-- que no hay backfill. Local corre `pnpm --filter @habla/db db:reset` y
-- producción se reseteará manualmente tras merge.
--
-- Si por alguna razón esta migración se corre sobre una BD con usuarios
-- cuyo `username` es NULL, la migración revienta — correcto, porque el
-- comportamiento posterior asume NOT NULL.

-- AlterTable: username → NOT NULL + nuevas columnas de registro formal.
ALTER TABLE "usuarios"
  ALTER COLUMN "username" SET NOT NULL,
  ADD COLUMN "usernameLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tycAceptadosAt" TIMESTAMP(3);

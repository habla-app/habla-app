-- Lote 6A: Tres bolsas de Lukas (Abr 2026).
--
-- Separa el balance del usuario en 3 bolsas con reglas distintas:
--   COMPRADAS: Lukas comprados con Culqi/Yape. Vencen a 36 meses.
--   BONUS: bono de bienvenida + bonus de packs. Sin vencimiento.
--   GANADAS: premios de torneos. Sin vencimiento. Únicas canjeables en /tienda.
--
-- Compatibilidad transicional: balanceLukas se mantiene como suma de las 3.
-- Será removido post-Lote 6B cuando la UI muestre los 3 bloques separados.
--
-- La columna `bolsa` en transacciones_lukas es nullable inicialmente.
-- El backfill la popula desde el historial vía POST /api/v1/admin/backfill/bolsas.
-- Un follow-up ALTER puede agregar NOT NULL constraint después del backfill.

-- 1. Enum BolsaLukas
CREATE TYPE "BolsaLukas" AS ENUM ('COMPRADAS', 'BONUS', 'GANADAS');

-- 2. Tres balances nuevos en usuarios (default 0 — backfill los popula)
ALTER TABLE "usuarios"
  ADD COLUMN "balanceCompradas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "balanceBonus"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "balanceGanadas"   INTEGER NOT NULL DEFAULT 0;

-- 3. Campos nuevos en transacciones_lukas
ALTER TABLE "transacciones_lukas"
  ADD COLUMN "bolsa"         "BolsaLukas",
  ADD COLUMN "metadata"      JSONB,
  ADD COLUMN "saldoVivo"     INTEGER,
  ADD COLUMN "vencAvisado30d" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vencAvisado7d"  BOOLEAN NOT NULL DEFAULT false;

-- 4. Toggle de notificaciones de vencimiento en preferencias_notif
ALTER TABLE "preferencias_notif"
  ADD COLUMN "notifVencimientos" BOOLEAN NOT NULL DEFAULT true;

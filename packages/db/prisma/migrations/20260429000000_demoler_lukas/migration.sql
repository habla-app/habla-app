-- Lote 2 (Abr 2026): demolición del sistema de Lukas + wallet.
--
-- Pivot del producto a "plataforma editorial + comunidad gratuita +
-- afiliación MINCETUR" (CLAUDE.md Apr 2026). Se eliminan:
--
--   - Las 4 columnas de balance del usuario (balanceLukas + 3 bolsas).
--   - Las columnas económicas del torneo (entradaLukas, pozoBruto,
--     pozoNeto, rake, distribPremios).
--   - El campo `premioLukas` del ticket (no se distribuyen premios).
--   - La tabla TransaccionLukas entera — no se preserva historial. La
--     contabilidad partida doble (Lote 8) sigue viva con sus asientos
--     existentes; los nuevos flujos económicos se reintroducen en
--     Lote 11+ con el sistema Premium/Cursos.
--   - Los enums BolsaLukas y TipoTransaccion.
--
-- ATENCIÓN — esta migración es destructiva. Asegurar backup manual a
-- R2 antes del deploy (POST /api/v1/admin/backup/ejecutar).
--
-- `notifVencimientos` de PreferenciasNotif NO se dropea acá: queda
-- agendado para Lote 3 que limpia el resto del schema (canjes,
-- verificaciones, etc.).

-- ---------------------------------------------------------------------------
-- Drop de columnas — usuarios
-- ---------------------------------------------------------------------------
ALTER TABLE "usuarios" DROP COLUMN "balanceLukas";
ALTER TABLE "usuarios" DROP COLUMN "balanceCompradas";
ALTER TABLE "usuarios" DROP COLUMN "balanceBonus";
ALTER TABLE "usuarios" DROP COLUMN "balanceGanadas";

-- ---------------------------------------------------------------------------
-- Drop de columnas — torneos
-- ---------------------------------------------------------------------------
ALTER TABLE "torneos" DROP COLUMN "entradaLukas";
ALTER TABLE "torneos" DROP COLUMN "pozoBruto";
ALTER TABLE "torneos" DROP COLUMN "pozoNeto";
ALTER TABLE "torneos" DROP COLUMN "rake";
ALTER TABLE "torneos" DROP COLUMN "distribPremios";

-- ---------------------------------------------------------------------------
-- Drop de columnas — tickets
-- ---------------------------------------------------------------------------
ALTER TABLE "tickets" DROP COLUMN "premioLukas";

-- ---------------------------------------------------------------------------
-- Drop tabla TransaccionLukas (no se preserva historial)
-- ---------------------------------------------------------------------------
DROP TABLE "transacciones_lukas";

-- ---------------------------------------------------------------------------
-- Drop enums
-- ---------------------------------------------------------------------------
DROP TYPE "BolsaLukas";
DROP TYPE "TipoTransaccion";

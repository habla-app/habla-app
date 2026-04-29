-- Lote 3 (Abr 2026): demolición de la tienda + canjes + verificaciones
-- (teléfono y DNI) + límites de juego responsable.
--
-- El pivot a "plataforma editorial + comunidad gratuita + afiliación
-- MINCETUR" (CLAUDE.md Abr 2026) terminó con todo el flujo monetario
-- propio: tras Lote 2 (que demolió Lukas + wallet), los premios físicos
-- ya no tenían modo de canjearse y los límites de juego responsable se
-- delegan al operador MINCETUR. Este lote elimina el resto del modelo:
--
--   - Tabla `canjes` (premios entregados / pendientes).
--   - Tabla `premios` (catálogo).
--   - Tabla `limites_juego` (límite mensual / diario / auto-exclusión).
--   - Tabla `verificacion_telefono` (códigos SMS).
--   - Tabla `verificacion_dni` (foto + estado).
--   - Enums `EstadoCanje`, `CategoriaPremio`, `BadgePremio`,
--     `EstadoVerifDni`.
--   - Columnas `telefono`, `telefonoVerif`, `dniVerif` del usuario.
--   - Columna `notifVencimientos` de preferencias_notif (Lukas no existe).
--
-- `notifPromos` SE CONSERVA: se reusa para el opt-in del newsletter
-- editorial y promos de afiliados (Lotes 4-5 y 8+).
--
-- ATENCIÓN — esta migración es destructiva. Asegurar backup manual a R2
-- antes del deploy (POST /api/v1/admin/backup/ejecutar con header
-- `Authorization: Bearer <CRON_SECRET>`).

-- ---------------------------------------------------------------------------
-- Drop tabla canjes (depende de premios y usuarios)
-- ---------------------------------------------------------------------------
DROP TABLE "canjes";

-- ---------------------------------------------------------------------------
-- Drop tabla premios
-- ---------------------------------------------------------------------------
DROP TABLE "premios";

-- ---------------------------------------------------------------------------
-- Drop tabla limites_juego
-- ---------------------------------------------------------------------------
DROP TABLE "limites_juego";

-- ---------------------------------------------------------------------------
-- Drop tablas verificacion_telefono / verificacion_dni
-- ---------------------------------------------------------------------------
DROP TABLE "verificacion_telefono";
DROP TABLE "verificacion_dni";

-- ---------------------------------------------------------------------------
-- Drop enums
-- ---------------------------------------------------------------------------
DROP TYPE "EstadoCanje";
DROP TYPE "CategoriaPremio";
DROP TYPE "BadgePremio";
DROP TYPE "EstadoVerifDni";

-- ---------------------------------------------------------------------------
-- Drop columnas — usuarios
-- ---------------------------------------------------------------------------
ALTER TABLE "usuarios" DROP COLUMN "telefono";
ALTER TABLE "usuarios" DROP COLUMN "telefonoVerif";
ALTER TABLE "usuarios" DROP COLUMN "dniVerif";

-- ---------------------------------------------------------------------------
-- Drop columna — preferencias_notif (notifPromos SE CONSERVA)
-- ---------------------------------------------------------------------------
ALTER TABLE "preferencias_notif" DROP COLUMN "notifVencimientos";

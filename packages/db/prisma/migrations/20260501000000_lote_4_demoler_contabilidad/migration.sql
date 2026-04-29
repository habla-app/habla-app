-- Lote 4 (Abr 2026): demolición del aparato contable de partida doble +
-- conciliación bancaria + auditoría continua + idempotencia del webhook
-- Culqi.
--
-- El pivot a "plataforma editorial + comunidad gratuita + afiliación
-- MINCETUR" (CLAUDE.md Abr 2026) ya había dejado sin uso al sistema
-- contable tras Lotes 2 y 3 (demolición de Lukas + tienda + canjes). No
-- hay más operación monetaria propia que registrar; los flujos de pago
-- futuros (Premium, Cursos) se manejan vía OpenPay desde Lote 12 con
-- modelo simple sin partida doble interna.
--
-- Este lote elimina, además, la integración Culqi entera: se decidió
-- migrar a OpenPay (BBVA) por costo, así que el adapter, el webhook y
-- la idempotencia (`eventos_culqi`) se borran. En Lote 12 se crea
-- `eventos_openpay` desde cero.
--
-- Tablas dropeadas (8) + 1 enum:
--   - asientos_lineas             (líneas debe/haber por cuenta)
--   - asientos                    (asientos de partida doble)
--   - cuentas_contables           (plan de cuentas, 11 cuentas seed)
--   - movimientos_banco_esperados (proyección de Caja-Banco al banco)
--   - movimientos_banco_reales    (parseado del extracto Interbank)
--   - cargas_extracto_banco       (audit de cada upload de CSV)
--   - auditoria_contable_logs     (Job I — log de auditoría continua)
--   - eventos_culqi               (idempotencia del webhook Culqi)
--   - enum "TipoCuenta"
--
-- ATENCIÓN — esta migración es destructiva. Asegurar backup manual a R2
-- antes del deploy (POST /api/v1/admin/backup/ejecutar con header
-- `Authorization: Bearer <CRON_SECRET>`).

-- ---------------------------------------------------------------------------
-- Drop hijos primero (asientos_lineas y movimientos_banco_esperados
-- tienen FKs a las tablas padre).
-- ---------------------------------------------------------------------------
DROP TABLE "asientos_lineas";
DROP TABLE "movimientos_banco_esperados";

-- ---------------------------------------------------------------------------
-- Drop padres (ya sin referencias entrantes).
-- ---------------------------------------------------------------------------
DROP TABLE "asientos";
DROP TABLE "cuentas_contables";
DROP TABLE "movimientos_banco_reales";

-- ---------------------------------------------------------------------------
-- Drop tablas independientes.
-- ---------------------------------------------------------------------------
DROP TABLE "cargas_extracto_banco";
DROP TABLE "auditoria_contable_logs";
DROP TABLE "eventos_culqi";

-- ---------------------------------------------------------------------------
-- Drop enum.
-- ---------------------------------------------------------------------------
DROP TYPE "TipoCuenta";

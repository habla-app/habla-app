-- Agrega REEMBOLSO al enum TipoTransaccion para torneos cancelados por
-- falta de inscritos (Sub-Sprint 3). Postgres requiere AFTER para posición.
ALTER TYPE "TipoTransaccion" ADD VALUE 'REEMBOLSO';

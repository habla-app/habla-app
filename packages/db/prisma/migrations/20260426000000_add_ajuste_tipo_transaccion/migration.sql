-- Lote 6B-fix2: agrega valor AJUSTE al enum TipoTransaccion
-- para registrar correcciones administrativas de balance (auditoría).
-- IF NOT EXISTS evita error si se corre dos veces.
ALTER TYPE "TipoTransaccion" ADD VALUE IF NOT EXISTS 'AJUSTE';

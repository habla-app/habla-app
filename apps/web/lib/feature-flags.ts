// Feature flags del Lote 8.
//
// `pagosHabilitados()` gobierna la pasarela Culqi Y el sistema contable
// como una unidad: con flag OFF estamos en modo PREVIEW (datos descartables,
// banner visual, endpoint reset-preview habilitado), con flag ON estamos
// en PRODUCCIÓN (irreversible, endpoint reset-preview bloqueado).
//
// Boot guard: si el flag está en `true` pero faltan creds Culqi, fuerza
// `false` y loggea error — evitamos abrir el endpoint de compra contra una
// pasarela rota. La razón vive en CLAUDE.md §"Gotchas".

import { logger } from "./services/logger";

export function pagosHabilitados(): boolean {
  if (process.env.PAGOS_HABILITADOS !== "true") return false;

  const creds =
    !!process.env.CULQI_PUBLIC_KEY &&
    !!process.env.CULQI_SECRET_KEY &&
    !!process.env.CULQI_WEBHOOK_SECRET;

  if (!creds) {
    logger.error(
      "[boot] PAGOS_HABILITADOS=true pero faltan creds Culqi — flag forzado a false",
    );
    return false;
  }
  return true;
}

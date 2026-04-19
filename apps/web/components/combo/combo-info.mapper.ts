// Mapper puro `GET /api/v1/torneos/:id → ComboTorneoInfo`. Se extrae del
// ComboLauncher para que MatchCardCTA + AutoOpenComboFromQuery reutilicen
// la misma derivación (primer premio estimado, placeholder, pozo neto
// fallback) sin duplicar lógica — y para poder cubrirlo con test puro
// sin levantar jsdom.
//
// Si el torneo sigue ABIERTO, `pozoNeto` en BD suele ser 0 porque recién
// se calcula al cierre. Aplicamos fallback `pozoBruto × 0.88` (el 88% del
// bruto — rake del 12% fijo por §6 CLAUDE.md).
//
// `computeComboFooterState` deriva el estado del footer del ComboModal:
// costo real, balance proyectado y si el balance es insuficiente para
// inscribirse. Con placeholder presente costoLukas=0 (ya se cobró al
// inscribirse al torneo). El bug del balance "-5" salía por mostrar
// `balance - entradaLukas` cuando `balance` aún no se había hidratado
// desde la sesión (store en 0). Ahora el modal nunca renderiza un
// balance proyectado negativo: si no alcanza, bloquea submit y muestra
// el CTA "Comprar Lukas".

import { PREMIO_PRIMER_LUGAR_PCT } from "./premios";
import type { ComboTorneoInfo } from "./ComboModal";

/**
 * Forma mínima que devuelve `GET /api/v1/torneos/:id` y que consumen los
 * launchers del ComboModal. Mantenerla en sync con
 * `apps/web/app/api/v1/torneos/[id]/route.ts`.
 */
export interface TorneoApiResponse {
  data?: {
    torneo: {
      id: string;
      nombre: string;
      entradaLukas: number;
      pozoBruto: number;
      pozoNeto: number;
      cierreAt: string;
      partido: { equipoLocal: string; equipoVisita: string };
    };
    miTicket: { id: string } | null;
  };
}

export function buildComboTorneoInfo(
  payload: TorneoApiResponse,
): ComboTorneoInfo | null {
  const d = payload.data;
  if (!d) return null;

  const pozoNeto =
    d.torneo.pozoNeto > 0
      ? d.torneo.pozoNeto
      : Math.floor(d.torneo.pozoBruto * 0.88);

  return {
    torneoId: d.torneo.id,
    partidoNombre: `${d.torneo.partido.equipoLocal} vs ${d.torneo.partido.equipoVisita}`,
    equipoLocal: d.torneo.partido.equipoLocal,
    equipoVisita: d.torneo.partido.equipoVisita,
    entradaLukas: d.torneo.entradaLukas,
    pozoBruto: d.torneo.pozoBruto,
    primerPremioEstimado: Math.floor(pozoNeto * PREMIO_PRIMER_LUGAR_PCT),
    cierreAt: d.torneo.cierreAt,
    tienePlaceholder: d.miTicket !== null,
  };
}

// ---------------------------------------------------------------------------
// Footer state — usado por ComboModal para renderizar "Balance después" y
// decidir si el botón debe ser "Inscribir / Confirmar" o "Comprar Lukas".
// ---------------------------------------------------------------------------

export interface ComboFooterState {
  /** Lukas a descontar al confirmar. 0 si hay placeholder (ya se cobró). */
  costoLukas: number;
  /** Balance que quedaría después del descuento. Puede ser negativo en el
   *  cálculo crudo, pero la UI siempre lo muestra clamped a 0 vía
   *  `displayBalanceDespues`. */
  balanceDespues: number;
  /** Versión clamped a 0 para mostrar en UI (nunca negativo). */
  displayBalanceDespues: number;
  /** True si no hay placeholder y el balance no alcanza la entrada.
   *  Bloquea el submit y dispara el modo "Comprar Lukas" del CTA. */
  balanceInsuficiente: boolean;
  /** "submit" → muestra el botón normal de inscribir/confirmar.
   *  "comprar" → reemplaza el botón por un link a /wallet. */
  ctaMode: "submit" | "comprar";
}

export function computeComboFooterState(opts: {
  balance: number;
  entradaLukas: number;
  tienePlaceholder: boolean;
}): ComboFooterState {
  const costoLukas = opts.tienePlaceholder ? 0 : opts.entradaLukas;
  const balanceDespues = opts.balance - costoLukas;
  const balanceInsuficiente =
    !opts.tienePlaceholder && opts.balance < opts.entradaLukas;
  return {
    costoLukas,
    balanceDespues,
    displayBalanceDespues: Math.max(0, balanceDespues),
    balanceInsuficiente,
    ctaMode: balanceInsuficiente ? "comprar" : "submit",
  };
}

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
 * Deriva pozo bruto + primer premio estimado a partir del par
 * `(pozoBruto, pozoNeto)` que viene de BD. Reglas:
 *   - Si `pozoNeto > 0` (torneo cerrado o con neto ya computado), se usa
 *     ese valor como base.
 *   - Si no, se asume `pozoBruto × 0.88` (rake del 12% por §6 CLAUDE.md).
 *   - El primer premio estimado es `floor(pozoNeto × 0.45)` (§6).
 *
 * Bug A del Mini-lote 7.6: tras enviar la combinada, el modal repinta el
 * header con estos valores derivados del torneo POST-create devuelto por
 * el endpoint, en vez del snapshot pre-mutación cargado al abrir.
 */
export function derivePozosDisplay(input: {
  pozoBruto: number;
  pozoNeto: number;
}): { pozoBruto: number; primerPremioEstimado: number } {
  const pozoNeto =
    input.pozoNeto > 0 ? input.pozoNeto : Math.floor(input.pozoBruto * 0.88);
  return {
    pozoBruto: input.pozoBruto,
    primerPremioEstimado: Math.floor(pozoNeto * PREMIO_PRIMER_LUGAR_PCT),
  };
}

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

  const { pozoBruto, primerPremioEstimado } = derivePozosDisplay({
    pozoBruto: d.torneo.pozoBruto,
    pozoNeto: d.torneo.pozoNeto,
  });

  return {
    torneoId: d.torneo.id,
    partidoNombre: `${d.torneo.partido.equipoLocal} vs ${d.torneo.partido.equipoVisita}`,
    equipoLocal: d.torneo.partido.equipoLocal,
    equipoVisita: d.torneo.partido.equipoVisita,
    entradaLukas: d.torneo.entradaLukas,
    pozoBruto,
    primerPremioEstimado,
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

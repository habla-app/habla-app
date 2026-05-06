// Mapeo central de IDs de liga × casa (Lote V.11 — May 2026).
//
// Cada casa filtra partidos en su API por un ID interno propio. Este
// archivo es el ÚNICO punto donde viven esos IDs — los scrapers solo
// reciben el ID resuelto, sin saber de qué liga viene.
//
// Para AGREGAR una nueva liga × casa al motor:
//   1. Vos descubrís el ID via DevTools navegando esa liga en la casa.
//   2. Editás el campo correspondiente en LIGAS_ID_POR_CASA.
//   3. Push. Sin cambios a los scrapers.
//
// Lote V.11 cubre 100% Liga 1 Perú (validado el 2026-05-05). Las otras
// 12 ligas activas tienen sus campos en `null` — el motor skipea
// silenciosamente para esa combinación liga × casa hasta que se descubra
// el ID.
//
// Las 13 ligas activas vienen del catálogo `LIGAS_ACTIVAS` (api-football)
// definido en `apps/web/lib/config/ligas.ts`.

import type { CasaCuotas } from "./types";

/**
 * Liga canónica usada como clave del mapeo. El motor recibe `partido.liga`
 * (texto libre tipo "Liga 1 Perú · Apertura") y lo normaliza a una de
 * estas claves antes de buscar el ID.
 */
export const LIGAS_CANONICAS = [
  "Liga 1 Perú",
  "Premier League",
  "La Liga",
  "UEFA Champions League",
  "Copa Libertadores",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Brasileirão",
  "Liga Profesional Argentina",
  "UEFA Europa League",
  "Copa Sudamericana",
  "Mundial 2026",
] as const;

export type LigaCanonica = (typeof LIGAS_CANONICAS)[number];

/**
 * Detecta a qué liga canónica pertenece un texto libre como
 * `partido.liga`. El texto suele venir de api-football con sufijos
 * de fase (ej. "Liga 1 Perú · Apertura", "Serie A · Brasil").
 *
 * Devuelve null si la liga no está cubierta — el orquestador skipea
 * esos partidos.
 */
export function detectarLigaCanonica(ligaTexto: string): LigaCanonica | null {
  if (ligaTexto.includes("Liga 1")) return "Liga 1 Perú";
  if (ligaTexto.includes("Premier")) return "Premier League";
  if (ligaTexto.includes("La Liga")) return "La Liga";
  if (ligaTexto.includes("Champions")) return "UEFA Champions League";
  if (ligaTexto.includes("Libertadores")) return "Copa Libertadores";
  // Importante: chequear "Brasi" ANTES de "Serie A" porque
  // "Brasileirão · Serie A" matchearía Serie A first.
  if (ligaTexto.includes("Brasi")) return "Brasileirão";
  if (ligaTexto.includes("Serie A")) return "Serie A";
  if (ligaTexto.includes("Bundesliga")) return "Bundesliga";
  if (ligaTexto.includes("Ligue 1")) return "Ligue 1";
  if (
    ligaTexto.includes("Argentin") ||
    ligaTexto.includes("Profesional Argentina")
  ) {
    return "Liga Profesional Argentina";
  }
  if (ligaTexto.includes("Europa League")) return "UEFA Europa League";
  if (ligaTexto.includes("Sudamericana")) return "Copa Sudamericana";
  if (ligaTexto.includes("Mundial") && !ligaTexto.includes("Clubes")) {
    return "Mundial 2026";
  }
  return null;
}

/**
 * Mapeo central de IDs por liga × casa.
 *
 * Liga 1 Perú: validados el 2026-05-05.
 * Otras ligas: completar el ID de cada casa cuando se descubra. Los
 * `null` actuales NO rompen el motor — solo hacen que esa combinación
 * skipee silenciosamente hasta tener el dato.
 */
const LIGAS_ID_POR_CASA: Record<
  LigaCanonica,
  Partial<Record<CasaCuotas, string>>
> = {
  "Liga 1 Perú": {
    doradobet: "4042",
    apuesta_total: "203110137349808128",
    betano: "17079",
    inkabet: "22988",
    te_apuesto: "1899",
  },
  "Premier League": {
    // doradobet: "2936" — del config Playwright legacy, validar antes de
    // habilitar. Mantener null hasta confirmar via DevTools en API.
  },
  "La Liga": {},
  "UEFA Champions League": {},
  "Copa Libertadores": {},
  "Serie A": {},
  Bundesliga: {},
  "Ligue 1": {},
  Brasileirão: {},
  "Liga Profesional Argentina": {},
  "UEFA Europa League": {},
  "Copa Sudamericana": {},
  "Mundial 2026": {},
};

/**
 * Resuelve el ID interno de una liga para una casa específica.
 * Devuelve null si la combinación no está mapeada — el orquestador
 * NO encola job para esa casa en ese partido.
 */
export function obtenerLigaIdParaCasa(
  ligaCanonica: LigaCanonica,
  casa: CasaCuotas,
): string | null {
  const map = LIGAS_ID_POR_CASA[ligaCanonica];
  if (!map) return null;
  return map[casa] ?? null;
}

/**
 * Helper que hace ambos pasos en uno: detectar liga canónica desde el
 * texto libre + resolver ID. Devuelve null si cualquier paso falla.
 */
export function obtenerLigaIdParaPartido(
  ligaTexto: string,
  casa: CasaCuotas,
): { ligaCanonica: LigaCanonica; ligaIdCasa: string } | null {
  const canonica = detectarLigaCanonica(ligaTexto);
  if (!canonica) return null;
  const id = obtenerLigaIdParaCasa(canonica, casa);
  if (!id) return null;
  return { ligaCanonica: canonica, ligaIdCasa: id };
}

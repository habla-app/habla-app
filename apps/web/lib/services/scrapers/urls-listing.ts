// Mapeo (casa × liga canónica) → URL del listado en navegador
// (Lote V.12 — May 2026).
//
// Cada casa expone una URL pública que muestra los partidos de una liga.
// El navegador headless carga esa URL y nosotros interceptamos las XHRs
// que el frontend hace para popular las cuotas.
//
// URLs validadas en el Lote V.10.2 (4 May 2026) para Liga 1 Perú. Otras
// 12 ligas activas tienen URLs por ahora `null` — se llenan cuando la
// liga se vuelve relevante (admin lo descubre y agrega acá).
//
// Para AGREGAR una nueva liga × casa:
//   1. Vos navegás a esa liga en la casa, copiás la URL del navegador.
//   2. Editás el campo correspondiente en URLS_LISTADO.
//   3. Push. Sin cambios a los scrapers.

import type { CasaCuotas } from "./types";
import type { LigaCanonica } from "./ligas-id-map";

const URLS_LISTADO: Record<
  LigaCanonica,
  Partial<Record<CasaCuotas, string>>
> = {
  "Liga 1 Perú": {
    doradobet: "https://doradobet.com/deportes/liga/4042",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=170&league=203110137349808128",
    coolbet:
      "https://www.coolbet.pe/pe/deportes/futbol/per%C3%BA/primera-division-peruana",
    betano: "https://www.betano.pe/sport/futbol/peru/liga-1/17079/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899",
  },
  "Premier League": {},
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

export function obtenerUrlListado(
  ligaCanonica: LigaCanonica,
  casa: CasaCuotas,
): string | null {
  const map = URLS_LISTADO[ligaCanonica];
  if (!map) return null;
  return map[casa] ?? null;
}

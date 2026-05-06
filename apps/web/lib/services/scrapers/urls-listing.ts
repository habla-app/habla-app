// Mapeo (casa × liga canónica) → URL del listado en navegador
// (Lote V.12 — May 2026, cableado al backend del motor Playwright + XHR).
//
// Cada casa expone una URL pública que muestra los partidos de una liga.
// El navegador headless carga esa URL y interceptamos las XHRs que el
// frontend hace para popular las cuotas.
//
// 5 casas activas (Stake removido por uso de aliases cortos no fuzzy-
// matcheables; Coolbet removido por WAF Imperva agresivo desde Railway).
// Las 5: doradobet (Altenar), apuesta_total (Kambi), betano (Danae),
// inkabet (Octonovus), te_apuesto (Coreix).
//
// 13 ligas activas, URLs validadas el 2026-05-06 con Bayern vs PSG en
// Champions League + Liga 1 Perú en commit c310fb9.

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
    betano: "https://www.betano.pe/sport/futbol/peru/liga-1/17079/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899",
  },
  "Premier League": {
    doradobet: "https://doradobet.com/deportes/liga/2936",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=260&league=24",
    betano: "https://www.betano.pe/sport/futbol/inglaterra/premier-league/1/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/inglaterra/inglaterra-premier-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/inglaterra/premier-league?id=1,139,1105",
  },
  "La Liga": {
    doradobet: "https://doradobet.com/deportes/liga/2941",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=65&league=38",
    betano: "https://www.betano.pe/sport/futbol/espana/laliga/5/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/espana/espana-la-liga?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/espana/laliga?id=1,25,1141",
  },
  "UEFA Champions League": {
    doradobet: "https://doradobet.com/deportes/liga/16808",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=125",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/champions-league/188566/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/champions-league/uefa-champions-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-champions-league?id=1,143,1417",
  },
  "Copa Libertadores": {
    doradobet: "https://doradobet.com/deportes/liga/3709",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=133",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/copa-libertadores/189817/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-libertadores/copa-libertadores?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/conmebol-libertadores?id=1,143,10009",
  },
  "Serie A": {
    doradobet: "https://doradobet.com/deportes/liga/2942",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=107&league=74",
    betano: "https://www.betano.pe/sport/futbol/italia/serie-a/1635/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/italia/italia-serie-a?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/italia/serie-a?id=1,379,1109",
  },
  Bundesliga: {
    doradobet: "https://doradobet.com/deportes/liga/2950",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=54&league=110",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/alemania/24/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/alemania/alemania-bundesliga?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/alemania/bundesliga?id=1,89,1139",
  },
  "Ligue 1": {
    doradobet: "https://doradobet.com/deportes/liga/2943",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=72&league=25",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/francia/23/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/francia/francia-ligue-1?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/francia/liga-1?id=1,684,1510",
  },
  Brasileirão: {
    doradobet: "https://doradobet.com/deportes/liga/11318",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=29&league=530",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/brasil/10004/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/brasil/brasil-serie-a?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/brasil/brasileiro,-serie-a?id=1,129,130",
  },
  "Liga Profesional Argentina": {
    doradobet: "https://doradobet.com/deportes/liga/3075",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=11&league=150",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/argentina/11319/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/argentina/argentina-liga-profesional?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/argentina/primera-lpf?id=1,56,9892",
  },
  "UEFA Europa League": {
    doradobet: "https://doradobet.com/deportes/liga/16809",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=2719",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/europa-league/188567/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/europa-league/uefa-europa-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-europa-league?id=1,143,1952",
  },
  "Copa Sudamericana": {
    doradobet: "https://doradobet.com/deportes/liga/3108",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=1699",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/copa-sudamericana/189818/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-sudamericana/copa-sudamericana?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/conmebol-sudamericana?id=1,143,10531",
  },
  "Mundial 2026": {
    doradobet: "https://doradobet.com/deportes/liga/3146",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=245&league=453456007969169408",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/mundial/189813/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/mundial/copa-del-mundo?tab=home",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional/copa-mundial?id=1,1,1197",
  },
};

export function obtenerUrlListado(
  ligaCanonica: LigaCanonica,
  casa: CasaCuotas,
): string | null {
  const map = URLS_LISTADO[ligaCanonica];
  if (!map) return null;
  return map[casa] ?? null;
}

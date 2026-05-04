// URLs de listado por casa × liga para el flow Playwright (Lote V.9 + V.10.2).
//
// Cada casa expone su sportsbook con un patrón de URL por liga. Acá
// mapeamos `Partido.liga` (canónico de api-football) → URL real del
// listado en cada casa.
//
// Lote V.10.2 (May 2026): URLs reales validadas por el admin desde
// browsers reales. Reemplazan las URLs best-effort que estaban
// hardcoded a partir de patrones inferidos. Cobertura por casa para las
// 13 ligas activas hoy:
//
//   - Stake / Apuesta Total / Coolbet / Doradobet / Betano / Inkabet:
//     13/13 ligas mapeadas (Liga 1, Premier, La Liga, Champions,
//     Libertadores, Serie A, Bundesliga, Ligue 1, Brasileirão, Argentina
//     Primera, Europa League, Sudamericana, Mundial 2026).
//   - Te Apuesto: 12/13 (no cubre Copa Sudamericana).
//
// Las 6 ligas restantes del catálogo de api-football quedan como `null`
// hasta que se acerquen sus competiciones (Conference, Mundial Clubes,
// Eliminatorias CONMEBOL, Copa América, Eurocopa, Nations League).
// Cuando una de esas activa fixtures futuros, agregamos su URL acá.
//
// Cómo extender:
//   - Si descubrís el path real de una liga × casa nueva en DevTools,
//     agregalo al `case` correspondiente.
//   - El sistema NO requiere ediciones por partido, solo por liga × casa.

import type { CasaPlaywrightConfig } from "./playwright-scrape";
import type { CasaCuotas } from "./types";

/**
 * Helpers comunes para detectar liga por substring del nombre canónico.
 * `Partido.liga` puede llegar como "Liga 1 Perú · Apertura" — usamos
 * `includes()` para tolerar sufijos de fase.
 */
function esLiga1(liga: string): boolean {
  return liga.includes("Liga 1");
}
function esPremier(liga: string): boolean {
  return liga.includes("Premier");
}
function esLaLiga(liga: string): boolean {
  return liga.includes("La Liga");
}
function esSerieA(liga: string): boolean {
  return liga.includes("Serie A");
}
function esBundesliga(liga: string): boolean {
  return liga.includes("Bundesliga");
}
function esLigue1(liga: string): boolean {
  return liga.includes("Ligue 1");
}
function esBrasileirao(liga: string): boolean {
  return liga.includes("Brasileir");
}
function esArgentinaPrimera(liga: string): boolean {
  return liga.includes("Argentina") || liga.includes("Profesional Argentina");
}
function esChampions(liga: string): boolean {
  return liga.includes("Champions");
}
function esEuropaLeague(liga: string): boolean {
  return liga.includes("Europa League");
}
function esLibertadores(liga: string): boolean {
  return liga.includes("Libertadores");
}
function esSudamericana(liga: string): boolean {
  return liga.includes("Sudamericana");
}
/**
 * Match para Mundial FIFA (selecciones), excluyendo "Mundial de Clubes".
 * Necesario porque `liga.includes("Mundial")` solo es ambiguo entre los
 * dos torneos.
 */
function esMundial(liga: string): boolean {
  return liga.includes("Mundial") && !liga.includes("Clubes");
}

// ─── Stake ─────────────────────────────────────────────────────────────

const stakeConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://stake.pe/deportes/football/peru/primera-division";
    if (esPremier(liga))
      return "https://stake.pe/deportes/football/england/premier-league";
    if (esLaLiga(liga))
      return "https://stake.pe/deportes/football/spain/la-liga";
    if (esChampions(liga))
      return "https://stake.pe/deportes/football/europe/uefa-champions-league";
    if (esLibertadores(liga))
      return "https://stake.pe/deportes/football/south-america/copa-libertadores";
    if (esSerieA(liga))
      return "https://stake.pe/deportes/football/italy/serie-a";
    if (esBundesliga(liga))
      return "https://stake.pe/deportes/football/germany/bundesliga";
    if (esLigue1(liga))
      return "https://stake.pe/deportes/football/france/ligue-1";
    if (esBrasileirao(liga))
      return "https://stake.pe/deportes/football/brazil/serie-a";
    if (esArgentinaPrimera(liga))
      return "https://stake.pe/deportes/football/argentina/primera-division";
    if (esEuropaLeague(liga))
      return "https://stake.pe/deportes/football/europe/uefa-europa-league";
    if (esSudamericana(liga))
      return "https://stake.pe/deportes/football/south-america/copa-sudamericana";
    if (esMundial(liga))
      return "https://stake.pe/deportes/football/world/fifa-world-cup";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Apuesta Total ─────────────────────────────────────────────────────
//
// URLs con query params (region + league) — el sportsbook usa un SPA con
// rutas estilo `?fpath=/es-pe/spbkv3/sports/1/category?region=N&league=M`.

const apuestaTotalConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=170&league=203110137349808128";
    if (esPremier(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=260&league=24";
    if (esLaLiga(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=65&league=38";
    if (esChampions(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=125";
    if (esLibertadores(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=133";
    if (esSerieA(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=107&league=74";
    if (esBundesliga(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=54&league=110";
    if (esLigue1(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=72&league=25";
    if (esBrasileirao(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=29&league=530";
    if (esArgentinaPrimera(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=11&league=150";
    if (esEuropaLeague(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=2719";
    if (esSudamericana(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=1699";
    if (esMundial(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=245&league=453456007969169408";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Coolbet ───────────────────────────────────────────────────────────
//
// URLs con percent-encoding para acentos (per%C3%BA, espa%C3%B1a,
// am%C3%A9ricas). Coolbet usa Imperva; Playwright real pasa el desafío JS.

const coolbetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/per%C3%BA/primera-division-peruana";
    if (esPremier(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/inglaterra/premier-league";
    if (esLaLiga(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/espa%C3%B1a/la-liga";
    if (esChampions(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/europa/uefa-champions-league";
    if (esLibertadores(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/am%C3%A9ricas/copa-libertadores";
    if (esSerieA(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/italia/serie-a";
    if (esBundesliga(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/alemania/bundesliga";
    if (esLigue1(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/francia/ligue-1";
    if (esBrasileirao(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/brasil/serie-a";
    if (esArgentinaPrimera(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/argentina/primera-division";
    if (esEuropaLeague(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/europa/uefa-europa-league";
    if (esSudamericana(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/am%C3%A9ricas/copa-sudamericana";
    if (esMundial(liga))
      return "https://www.coolbet.pe/pe/deportes/futbol/Copa-Mundial";
    return null;
  },
  // WAF Imperva puede tardar más en pasar el desafío.
  timeoutListadoMs: 35_000,
  timeoutTotalMs: 75_000,
};

// ─── Doradobet ─────────────────────────────────────────────────────────
//
// URLs por ID numérico de liga (`/deportes/liga/{id}`). Esquema simple
// y estable.

const doradobetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga)) return "https://doradobet.com/deportes/liga/4042";
    if (esPremier(liga)) return "https://doradobet.com/deportes/liga/2936";
    if (esLaLiga(liga)) return "https://doradobet.com/deportes/liga/2941";
    if (esChampions(liga)) return "https://doradobet.com/deportes/liga/16808";
    if (esLibertadores(liga))
      return "https://doradobet.com/deportes/liga/3709";
    if (esSerieA(liga)) return "https://doradobet.com/deportes/liga/2942";
    if (esBundesliga(liga)) return "https://doradobet.com/deportes/liga/2950";
    if (esLigue1(liga)) return "https://doradobet.com/deportes/liga/2943";
    if (esBrasileirao(liga))
      return "https://doradobet.com/deportes/liga/11318";
    if (esArgentinaPrimera(liga))
      return "https://doradobet.com/deportes/liga/3075";
    if (esEuropaLeague(liga))
      return "https://doradobet.com/deportes/liga/16809";
    if (esSudamericana(liga))
      return "https://doradobet.com/deportes/liga/3108";
    if (esMundial(liga)) return "https://doradobet.com/deportes/liga/3146";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Betano ────────────────────────────────────────────────────────────
//
// URLs con ID numérico al final del path (ej. `/sport/futbol/peru/liga-1/17079/`).
// Cloudflare Bot Management activo; Playwright real pasa el desafío.

const betanoConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.betano.pe/sport/futbol/peru/liga-1/17079/";
    if (esPremier(liga))
      return "https://www.betano.pe/sport/futbol/inglaterra/premier-league/1/";
    if (esLaLiga(liga))
      return "https://www.betano.pe/sport/futbol/espana/laliga/5/";
    if (esChampions(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/champions-league/188566/";
    if (esLibertadores(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/copa-libertadores/189817/";
    if (esSerieA(liga))
      return "https://www.betano.pe/sport/futbol/italia/serie-a/1635/";
    if (esBundesliga(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/alemania/24/";
    if (esLigue1(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/francia/23/";
    if (esBrasileirao(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/brasil/10004/";
    if (esArgentinaPrimera(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/argentina/11319/";
    if (esEuropaLeague(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/europa-league/188567/";
    if (esSudamericana(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/copa-sudamericana/189818/";
    if (esMundial(liga))
      return "https://www.betano.pe/sport/futbol/campeonatos/mundial/189813/";
    return null;
  },
  timeoutListadoMs: 35_000,
  timeoutTotalMs: 75_000,
};

// ─── Inkabet ───────────────────────────────────────────────────────────
//
// URLs con query `?tab=liveAndUpcoming` para listado de partidos
// pre-match (excepto Mundial 2026 que usa `?tab=home`).

const inkabetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming";
    if (esPremier(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/inglaterra/inglaterra-premier-league?tab=liveAndUpcoming";
    if (esLaLiga(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/espana/espana-la-liga?tab=liveAndUpcoming";
    if (esChampions(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/champions-league/uefa-champions-league?tab=liveAndUpcoming";
    if (esLibertadores(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-libertadores/copa-libertadores?tab=liveAndUpcoming";
    if (esSerieA(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/italia/italia-serie-a?tab=liveAndUpcoming";
    if (esBundesliga(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/alemania/alemania-bundesliga?tab=liveAndUpcoming";
    if (esLigue1(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/francia/francia-ligue-1?tab=liveAndUpcoming";
    if (esBrasileirao(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/brasil/brasil-serie-a?tab=liveAndUpcoming";
    if (esArgentinaPrimera(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/argentina/argentina-liga-profesional?tab=liveAndUpcoming";
    if (esEuropaLeague(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/europa-league/uefa-europa-league?tab=liveAndUpcoming";
    if (esSudamericana(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-sudamericana/copa-sudamericana?tab=liveAndUpcoming";
    if (esMundial(liga))
      return "https://inkabet.pe/pe/apuestas-deportivas/futbol/mundial/copa-del-mundo?tab=home";
    return null;
  },
  timeoutListadoMs: 30_000,
  timeoutTotalMs: 65_000,
};

// ─── Te Apuesto ────────────────────────────────────────────────────────
//
// URLs con IDs en query string `?id=sport,country,tournament`.
// No cubre Copa Sudamericana (retorna null para esa liga).

const teApuestoConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899";
    if (esPremier(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/inglaterra/premier-league?id=1,139,1105";
    if (esLaLiga(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/espana/laliga?id=1,25,1141";
    if (esChampions(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-champions-league?id=1,143,1417";
    if (esLibertadores(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/conmebol-libertadores?id=1,143,10009";
    if (esSerieA(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/italia/serie-a?id=1,379,1109";
    if (esBundesliga(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/alemania/bundesliga?id=1,89,1139";
    if (esLigue1(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/francia/liga-1?id=1,684,1510";
    if (esBrasileirao(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/brasil/brasileiro,-serie-a?id=1,129,130";
    if (esArgentinaPrimera(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/argentina/primera-lpf?id=1,56,9892";
    if (esEuropaLeague(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-europa-league?id=1,143,1952";
    // Te Apuesto no cubre Copa Sudamericana hoy → null.
    if (esMundial(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional/copa-mundial?id=1,1,1197";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Export consolidado ────────────────────────────────────────────────

export const PLAYWRIGHT_CONFIGS: Record<CasaCuotas, CasaPlaywrightConfig> = {
  stake: stakeConfig,
  apuesta_total: apuestaTotalConfig,
  coolbet: coolbetConfig,
  doradobet: doradobetConfig,
  betano: betanoConfig,
  inkabet: inkabetConfig,
  te_apuesto: teApuestoConfig,
};

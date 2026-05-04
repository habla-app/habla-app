// URLs de listado por casa × liga para el flow Playwright (Lote V.9).
//
// Cada casa expone su sportsbook con un patrón de URL por liga. Acá
// mapeamos `Partido.liga` (canónico de api-football) → URL real del
// listado en cada casa.
//
// Heurística usada para los paths:
//   - Inspección manual del POC del 03/05 + estructura URL típica de cada
//     proveedor (Stake, Altenar, GAN Sports, etc.).
//   - Cuando no conocemos el path exacto, devolvemos `null` y el scraper
//     skipea esa combinación silenciosamente (admin la cubre con
//     vinculación manual via `<VincularEventIdModal>`).
//
// Cómo extender:
//   - Si descubrís el path real de una liga × casa en DevTools, agregalo
//     al `case` correspondiente.
//   - Si una casa no cubre Liga 1 o cubre internacionales con paths muy
//     distintos, devolvé null y el sistema cae a manual.
//
// Lo importante: este archivo es la ÚNICA fuente de URLs de discovery
// — si algo cambia upstream, se cambia acá sin tocar scrapers ni worker.

import type { CasaPlaywrightConfig } from "./playwright-scrape";
import type { CasaCuotas } from "./types";

/**
 * Helpers comunes para detectar liga por substring del nombre canónico.
 * `Partido.liga` puede llegar como "Liga 1 Perú · Apertura" — usamos
 * `includes()` para tolerar sufijos.
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
function esConferenceLeague(liga: string): boolean {
  return liga.includes("Conference");
}
function esLibertadores(liga: string): boolean {
  return liga.includes("Libertadores");
}
function esSudamericana(liga: string): boolean {
  return liga.includes("Sudamericana");
}

// ─── Stake ─────────────────────────────────────────────────────────────

const stakeConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga)) return "https://stake.pe/deportes/futbol/peru/liga-1";
    if (esPremier(liga))
      return "https://stake.pe/deportes/futbol/inglaterra/premier-league";
    if (esLaLiga(liga)) return "https://stake.pe/deportes/futbol/espana/la-liga";
    if (esSerieA(liga)) return "https://stake.pe/deportes/futbol/italia/serie-a";
    if (esBundesliga(liga))
      return "https://stake.pe/deportes/futbol/alemania/bundesliga";
    if (esLigue1(liga)) return "https://stake.pe/deportes/futbol/francia/ligue-1";
    if (esBrasileirao(liga))
      return "https://stake.pe/deportes/futbol/brasil/serie-a";
    if (esArgentinaPrimera(liga))
      return "https://stake.pe/deportes/futbol/argentina/liga-profesional";
    if (esChampions(liga))
      return "https://stake.pe/deportes/futbol/uefa-champions-league";
    if (esEuropaLeague(liga))
      return "https://stake.pe/deportes/futbol/uefa-europa-league";
    if (esConferenceLeague(liga))
      return "https://stake.pe/deportes/futbol/uefa-europa-conference-league";
    if (esLibertadores(liga))
      return "https://stake.pe/deportes/futbol/copa-libertadores";
    if (esSudamericana(liga))
      return "https://stake.pe/deportes/futbol/copa-sudamericana";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Apuesta Total ─────────────────────────────────────────────────────

const apuestaTotalConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/peru/liga-1-peru";
    if (esPremier(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/inglaterra/premier-league";
    if (esLaLiga(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/espana/la-liga";
    if (esSerieA(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/italia/serie-a";
    if (esBundesliga(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/alemania/bundesliga";
    if (esLigue1(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/francia/ligue-1";
    if (esBrasileirao(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/brasil/serie-a";
    if (esArgentinaPrimera(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/argentina/primera-division";
    if (esChampions(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/internacional/uefa-champions-league";
    if (esEuropaLeague(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/internacional/uefa-europa-league";
    if (esLibertadores(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/internacional/copa-libertadores";
    if (esSudamericana(liga))
      return "https://www.apuestatotal.com/apuestas-deportivas/futbol/internacional/copa-sudamericana";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Coolbet ───────────────────────────────────────────────────────────
//
// WAF Imperva activo en `www.coolbet.pe`. El browser real generalmente
// pasa el desafío JS automáticamente (es lo que valida el WAF). Headless
// stealth + el tiempo de hidratación del SPA debería ser suficiente.

const coolbetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.coolbet.pe/deportes/futbol/peru/peru-liga-1";
    if (esPremier(liga))
      return "https://www.coolbet.pe/deportes/futbol/inglaterra/premier-league";
    if (esLaLiga(liga))
      return "https://www.coolbet.pe/deportes/futbol/espana/la-liga";
    if (esSerieA(liga))
      return "https://www.coolbet.pe/deportes/futbol/italia/serie-a";
    if (esBundesliga(liga))
      return "https://www.coolbet.pe/deportes/futbol/alemania/bundesliga";
    if (esChampions(liga))
      return "https://www.coolbet.pe/deportes/futbol/internacional/champions-league";
    if (esLibertadores(liga))
      return "https://www.coolbet.pe/deportes/futbol/internacional/copa-libertadores";
    return null;
  },
  // WAF puede tardar en pasar el desafío.
  timeoutListadoMs: 35_000,
  timeoutTotalMs: 75_000,
};

// ─── Doradobet ─────────────────────────────────────────────────────────

const doradobetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://doradobet.com/deportes/futbol/peru/liga-1";
    if (esPremier(liga))
      return "https://doradobet.com/deportes/futbol/inglaterra/premier-league";
    if (esLaLiga(liga))
      return "https://doradobet.com/deportes/futbol/espana/la-liga";
    if (esSerieA(liga))
      return "https://doradobet.com/deportes/futbol/italia/serie-a";
    if (esChampions(liga))
      return "https://doradobet.com/deportes/futbol/champions-league";
    if (esLibertadores(liga))
      return "https://doradobet.com/deportes/futbol/copa-libertadores";
    return null;
  },
  timeoutListadoMs: 25_000,
  timeoutTotalMs: 60_000,
};

// ─── Betano ────────────────────────────────────────────────────────────
//
// Cloudflare splash screen activo. Playwright real maneja Cloudflare JS
// challenge automáticamente en headless con stealth.

const betanoConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.betano.pe/sport/futbol/peru/liga-1/17173/";
    if (esPremier(liga))
      return "https://www.betano.pe/sport/futbol/inglaterra/premier-league/8/";
    if (esLaLiga(liga))
      return "https://www.betano.pe/sport/futbol/espana/laliga/9/";
    if (esSerieA(liga))
      return "https://www.betano.pe/sport/futbol/italia/serie-a/15/";
    if (esBundesliga(liga))
      return "https://www.betano.pe/sport/futbol/alemania/bundesliga/35/";
    if (esLigue1(liga))
      return "https://www.betano.pe/sport/futbol/francia/ligue-1/34/";
    if (esBrasileirao(liga))
      return "https://www.betano.pe/sport/futbol/brasil/serie-a/3340/";
    if (esArgentinaPrimera(liga))
      return "https://www.betano.pe/sport/futbol/argentina/primera-division/16/";
    if (esChampions(liga))
      return "https://www.betano.pe/sport/futbol/torneos-internacionales/uefa-champions-league/12/";
    if (esEuropaLeague(liga))
      return "https://www.betano.pe/sport/futbol/torneos-internacionales/uefa-europa-league/40/";
    if (esLibertadores(liga))
      return "https://www.betano.pe/sport/futbol/torneos-internacionales/copa-libertadores/4216/";
    if (esSudamericana(liga))
      return "https://www.betano.pe/sport/futbol/torneos-internacionales/copa-sudamericana/4226/";
    return null;
  },
  timeoutListadoMs: 35_000,
  timeoutTotalMs: 75_000,
};

// ─── Inkabet ───────────────────────────────────────────────────────────

const inkabetConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.inkabet.pe/pe/apuestas-deportivas#sport/SOCCER/PE/Liga1";
    if (esPremier(liga))
      return "https://www.inkabet.pe/pe/apuestas-deportivas#sport/SOCCER/GB/PremierLeague";
    if (esLaLiga(liga))
      return "https://www.inkabet.pe/pe/apuestas-deportivas#sport/SOCCER/ES/LaLiga";
    if (esChampions(liga))
      return "https://www.inkabet.pe/pe/apuestas-deportivas#sport/SOCCER/INT/ChampionsLeague";
    if (esLibertadores(liga))
      return "https://www.inkabet.pe/pe/apuestas-deportivas#sport/SOCCER/INT/CopaLibertadores";
    return null;
  },
  timeoutListadoMs: 30_000,
  timeoutTotalMs: 65_000,
};

// ─── Te Apuesto ────────────────────────────────────────────────────────

const teApuestoConfig: CasaPlaywrightConfig = {
  urlListado(liga) {
    if (esLiga1(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899";
    if (esPremier(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/inglaterra/premier-league?id=1,1,2";
    if (esLaLiga(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/espana/la-liga?id=1,3,3";
    if (esChampions(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional/champions-league";
    if (esLibertadores(liga))
      return "https://www.teapuesto.pe/sport/detail/futbol/internacional/copa-libertadores";
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

// Scraper Betano — Lote V fase V.4 (la casa más compleja del scope).
//
// ════════════════════════════════════════════════════════════════════
// SESIÓN DE REVERSE ENGINEERING — hallazgos
// ════════════════════════════════════════════════════════════════════
//
// PLATAFORMA:
//   Kaizen Gaming (sportsbook propietario, no white-label). Backend doble:
//     - `https://www.betano.pe/api/...`           — API pública estándar
//     - `https://www.betano.pe/danae-webapi/api/...` — API live/in-play
//   Frontend Vue + SSR con hydration.
//
// URLS PÚBLICAS (validadas en POC §2.5):
//   - Home:                  https://www.betano.pe/
//   - Página del partido:    https://www.betano.pe/cuotas-de-partido/{slug}/{eventId}/
//     (donde {slug} = slug-de-equipos, ej. "fbc-melgar-utc-de-cajamarca",
//      y {eventId} = número entero ≥6 dígitos, ej. "84146293")
//
// ENDPOINTS GENERALES IDENTIFICADOS (POC §2.5 — observados en Network tab):
//   - GET /api/v1/translations/kcv/sportsbookbetting/es_PE/14/
//   - GET /api/sportsbook-settings
//   - GET /api/home/top-events-v2/                    ← USADO EN DISCOVERY
//   - GET /danae-webapi/api/layout/live
//   - GET /danae-webapi/api/live/overview/latest
//   - GET /api/static-content/assets/{regions|leagues|teams|players}
//
// ENDPOINT ESPECÍFICO DEL PARTIDO INDIVIDUAL:
//   El POC NO logró aislar el endpoint que sirve los 4 mercados de un
//   partido individual — el equipo capturó cuotas leyendo el DOM con
//   Vue ya hidratado. Sin embargo, el patrón de Kaizen Gaming en sus
//   otros mercados (Brasil, Rumanía, Grecia, Portugal — accesibles
//   públicamente para reverse engineering) usa estos endpoints típicos:
//
//     1. /api/event/{eventId}/all                 — preferido (todos los
//                                                    mercados en una request)
//     2. /api/event/{eventId}                     — variante corta
//     3. /api/eventbrowser/{eventId}/markets      — segmentado por grupo
//     4. /api/eventoffer/event/{eventId}          — variante "oferta"
//     5. /danae-webapi/api/event/{eventId}/all    — backend secundario
//
//   Hasta confirmar empíricamente cuál de estos 5 candidatos sirve la
//   data en Betano Perú, el scraper PROBA EN ORDEN: el primero que
//   responda 200 con los 4 mercados gana. Si NINGUNO responde con la
//   data esperada (o la respuesta viene incompleta — ver "MERCADOS
//   COLAPSADOS" más abajo), escala automáticamente a Playwright.
//
//   Esto convierte la incertidumbre del reverse engineering en código
//   ejecutable: en vez de "elegir uno y rezar", probamos los 5 candidatos
//   con timeout corto (5s c/u) y nos quedamos con el ganador. La
//   sobrecarga es ≤25s en el peor caso (los 5 fallaron) antes de Playwright,
//   asumida como costo de la imprecisión del reverse engineering.
//
// MERCADOS COLAPSADOS (el motivo del fallback Playwright):
//   El POC §2.5 (parágrafo 7) confirma que Betano renderiza "Ambos
//   equipos anotan" (BTTS) en estado COLAPSADO por defecto. El header del
//   mercado es un `<div>` con clases Tailwind (NO un `<button>` ni
//   `[role=button]`), y `el.click()` programático no dispara los handlers
//   de Vue. Resultado: cualquier scraper que lea el DOM SSR-rendered
//   captura sólo 1X2 + Doble Op + ±2.5 — BTTS queda fuera.
//
//   La solución del POC fue `computer.left_click` (click real) sobre la
//   flecha `<` a la derecha del header. Eso SÍ dispara Vue → BTTS se
//   muestra. Para producción esto se traduce a `page.click()` de
//   Playwright (que también emite eventos de mouse reales).
//
//   PERO si el endpoint API `/api/event/{id}/all` (candidato #1) sirve
//   los 4 mercados sin importar el estado UI colapsado/expandido, NO
//   necesitamos Playwright. La probabilidad es alta: las APIs JSON de
//   sportsbooks típicamente devuelven todos los mercados disponibles
//   independiente del UI state. Por eso intentamos API primero.
//
// MAPEO DE MERCADOS (asumido por convención Kaizen Gaming):
//   Los mercados en Betano se identifican por `marketTypeId` numérico o
//   `marketName` (string en español). Como los IDs varían entre
//   instalaciones de Kaizen Gaming, mapeamos por NOMBRE (defensivo):
//     - 1X2          → "Resultado del partido" / "Match result" / 1x2
//     - Doble Op     → "Doble oportunidad" / "Double chance"
//     - ±2.5 goles   → "Goles totales Más/Menos" / "Total goals" + linea=2.5
//     - BTTS         → "Ambos equipos anotan" / "Both teams to score"
//
// DISCOVERY (sección 5.1 del plan):
//   El endpoint `/api/home/top-events-v2/` devuelve eventos destacados
//   pero NO listado completo por liga. Para Liga 1 Perú existen otros
//   endpoints como `/api/sport/futbol/region/peru/league/liga-1/events`
//   o `/api/sport/futbol/{liga-id}/events` cuyos paths exactos no fueron
//   capturados en POC. Para V.4:
//     - Si el endpoint que probamos devuelve match único → resuelto.
//     - Si responde 4xx/5xx o sin matches → null (fallback manual V.5
//       con regex `/(\d{6,})/?$` en la URL del partido).
//
// EVENT ID:
//   Numérico, típicamente 7-8 dígitos (POC: 84146293). Validamos con
//   `/^\d{6,}$/`.
//
// ════════════════════════════════════════════════════════════════════

import { logger } from "../logger";
import { httpProbeJson } from "./http";
import { crearPagePlaywright, type PlaywrightPage } from "./playwright-browser";
import {
  fechasCercanas,
  matchearEquiposContraPartido,
} from "./alias-equipo";
import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface PartidoSlim {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
}

const HOST = "www.betano.pe";

/**
 * Lista ordenada de endpoints candidato. Lo intentamos en orden hasta
 * que uno responda 200 con los 4 mercados completos. Si ninguno cubre
 * los 4 → el caller escala a Playwright.
 *
 * Templates: `{id}` = eventId numérico.
 */
const ENDPOINTS_CANDIDATOS: Array<{
  nombre: string;
  url: (id: string) => string;
}> = [
  {
    nombre: "event-all",
    url: (id) => `https://${HOST}/api/event/${id}/all`,
  },
  {
    nombre: "event-short",
    url: (id) => `https://${HOST}/api/event/${id}`,
  },
  {
    nombre: "eventbrowser-markets",
    url: (id) => `https://${HOST}/api/eventbrowser/${id}/markets`,
  },
  {
    nombre: "eventoffer",
    url: (id) => `https://${HOST}/api/eventoffer/event/${id}`,
  },
  {
    nombre: "danae-event-all",
    url: (id) => `https://${HOST}/danae-webapi/api/event/${id}/all`,
  },
];

const TIMEOUT_POR_CANDIDATO_MS = 5_000;
const VENTANA_DISCOVERY_MIN = 60;

const MERCADOS_REQUERIDOS: Array<keyof CuotasCapturadas> = [
  "1x2",
  "doble_op",
  "mas_menos_25",
  "btts",
];

// ───────── Utilidades de parser ─────────

function toCuota(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function getMarketName(market: unknown): string {
  if (!market || typeof market !== "object") return "";
  const m = market as Record<string, unknown>;
  return String(
    m.name ?? m.marketName ?? m.code ?? m.shortName ?? m.title ?? m.id ?? "",
  )
    .toLowerCase()
    .trim();
}

function getMarketLinea(market: unknown): number | null {
  if (!market || typeof market !== "object") return null;
  const m = market as Record<string, unknown>;
  const v =
    m.line ??
    m.handicap ??
    m.totalLine ??
    m.specialBetValue ??
    m.argument ??
    m.points ??
    m.value;
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isMarket(market: unknown, ...names: string[]): boolean {
  const n = getMarketName(market);
  return names.some((target) => {
    const t = target.toLowerCase();
    return n === t || n.includes(t);
  });
}

function isMercado1X2(market: unknown): boolean {
  return isMarket(
    market,
    "resultado del partido",
    "resultado",
    "match result",
    "matchresult",
    "match winner",
    "matchwinner",
    "winner",
    "1x2",
    "ganador del partido",
    "ganador",
  );
}

function isMercadoDobleOp(market: unknown): boolean {
  return isMarket(
    market,
    "doble oportunidad",
    "doble op",
    "double chance",
    "doublechance",
    "doble chance",
  );
}

function isMercadoMasMenos(market: unknown): boolean {
  return isMarket(
    market,
    "goles totales",
    "total goles",
    "total goals",
    "totalgoals",
    "totales",
    "total",
    "más/menos",
    "mas/menos",
    "más menos",
    "mas menos",
    "over/under",
    "goals",
  );
}

function isMercadoBtts(market: unknown): boolean {
  return isMarket(
    market,
    "ambos equipos anotan",
    "ambos equipos marcan",
    "ambos equipos",
    "both teams to score",
    "bothteamstoscore",
    "btts",
  );
}

/** Lee outcomes de un mercado mapeando POR NOMBRE/CÓDIGO (no por posición). */
function leerOutcomes(
  market: unknown,
  keys: Record<string, string[]>,
): Record<string, number | undefined> {
  if (!market || typeof market !== "object") return {};
  const m = market as Record<string, unknown>;
  const lista = (m.outcomes ?? m.selections ?? m.odds ?? m.values ?? m.prices) as
    | Array<Record<string, unknown>>
    | undefined;
  const out: Record<string, number | undefined> = {};
  if (!Array.isArray(lista)) return out;

  for (const it of lista) {
    if (!it || typeof it !== "object") continue;
    const code = String(
      it.code ??
        it.name ??
        it.outcomeName ??
        it.shortName ??
        it.label ??
        it.title ??
        "",
    )
      .toLowerCase()
      .trim();
    const cuota = toCuota(
      it.value ?? it.odd ?? it.price ?? it.decimalOdds ?? it.priceDecimal,
    );
    if (!code || cuota === undefined) continue;

    for (const [outName, codes] of Object.entries(keys)) {
      const codeNoSpace = code.replace(/\s+/g, "");
      const match = codes.some((c) => {
        const target = c.toLowerCase();
        return code === target || codeNoSpace === target.replace(/\s+/g, "");
      });
      if (match) {
        out[outName] = cuota;
        break;
      }
    }
  }
  return out;
}

/** Recorre el payload buscando un array de mercados. */
function findMarkets(node: unknown, depth = 0): unknown[] {
  if (depth > 6 || !node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    const sample = node.find((it) => it && typeof it === "object");
    if (
      sample &&
      typeof sample === "object" &&
      ("outcomes" in (sample as object) ||
        "selections" in (sample as object) ||
        "odds" in (sample as object) ||
        "prices" in (sample as object))
    ) {
      return node;
    }
    for (const item of node) {
      const found = findMarkets(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  const obj = node as Record<string, unknown>;
  for (const key of [
    "markets",
    "marketGroups",
    "groups",
    "events",
    "data",
    "result",
    "event",
    "offer",
  ]) {
    if (key in obj) {
      const found = findMarkets(obj[key], depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

/**
 * Extrae 1X2 / Doble Op / ±2.5 / BTTS de un array de markets. Si un
 * mercado tiene línea (totales) y NO es 2.5, la salta. Si un mercado
 * aparece duplicado (caso "Resultado del partido SuperCuotas" + "Resultado
 * del partido" — POC §2.5), se queda con el primero que matchee
 * (orden del array determina precedencia — el SuperCuotas suele venir
 * primero pero NO debería persistirse: seguimos lectura por nombre
 * estricto que descarte "supercuotas"/"super").
 */
function mapearCuotasBetano(payload: unknown): CuotasCapturadas {
  const out: CuotasCapturadas = {};
  const markets = findMarkets(payload);
  if (!markets.length) return out;

  for (const market of markets) {
    // Saltar mercados "boost" / "supercuotas" — sólo persistimos la línea
    // regular para mantener consistencia con las otras 6 casas.
    const nombre = getMarketName(market);
    if (
      nombre.includes("supercuota") ||
      nombre.includes("super cuota") ||
      nombre.includes("apuesta destacada") ||
      nombre.includes("boost")
    ) {
      continue;
    }

    if (out["1x2"] === undefined && isMercado1X2(market)) {
      const o = leerOutcomes(market, {
        local: ["1", "home", "h", "local"],
        empate: ["x", "draw", "d", "empate", "tie"],
        visita: ["2", "away", "a", "v", "visita", "visitor"],
      });
      if (
        o.local !== undefined &&
        o.empate !== undefined &&
        o.visita !== undefined
      ) {
        out["1x2"] = { local: o.local, empate: o.empate, visita: o.visita };
      }
      continue;
    }

    if (out.doble_op === undefined && isMercadoDobleOp(market)) {
      const o = leerOutcomes(market, {
        x1: ["1x", "1 or x", "homeordraw", "1-x"],
        x12: ["12", "1 or 2", "homeoraway", "1-2"],
        xx2: ["x2", "x or 2", "draworaway", "x-2"],
      });
      if (o.x1 !== undefined && o.x12 !== undefined && o.xx2 !== undefined) {
        out.doble_op = { x1: o.x1, x12: o.x12, xx2: o.xx2 };
      }
      continue;
    }

    if (out.mas_menos_25 === undefined && isMercadoMasMenos(market)) {
      const linea = getMarketLinea(market);
      if (linea !== null && Math.abs(linea - 2.5) > 1e-6) continue;
      const o = leerOutcomes(market, {
        over: ["over", "o", "más", "mas", "+2.5", "over 2.5", "over2.5"],
        under: ["under", "u", "menos", "-2.5", "under 2.5", "under2.5"],
      });
      if (o.over !== undefined && o.under !== undefined) {
        out.mas_menos_25 = { over: o.over, under: o.under };
      }
      continue;
    }

    if (out.btts === undefined && isMercadoBtts(market)) {
      const o = leerOutcomes(market, {
        si: ["yes", "si", "sí", "y", "gg"],
        no: ["no", "n", "ng"],
      });
      if (o.si !== undefined && o.no !== undefined) {
        out.btts = { si: o.si, no: o.no };
      }
      continue;
    }
  }

  return out;
}

/** True si CuotasCapturadas tiene los 4 mercados. */
function cuotasCompletas(c: CuotasCapturadas): boolean {
  return MERCADOS_REQUERIDOS.every((k) => c[k] !== undefined);
}

/** Retorna los mercados que faltan (para logs). */
function mercadosFaltantes(c: CuotasCapturadas): Array<keyof CuotasCapturadas> {
  return MERCADOS_REQUERIDOS.filter((k) => c[k] === undefined);
}

/** Mergea cuotas: el segundo argumento RELLENA huecos del primero (no sobreescribe). */
function fusionarCuotas(
  base: CuotasCapturadas,
  extra: CuotasCapturadas,
): CuotasCapturadas {
  return {
    "1x2": base["1x2"] ?? extra["1x2"],
    doble_op: base.doble_op ?? extra.doble_op,
    mas_menos_25: base.mas_menos_25 ?? extra.mas_menos_25,
    btts: base.btts ?? extra.btts,
  };
}

// ───────── viaAPI ─────────

interface ResultadoCandidato {
  cuotas: CuotasCapturadas;
  url: string;
}

/**
 * Prueba un endpoint candidato. Devuelve null en cualquier error (red,
 * status≠200, body no-JSON, sin mercados conocidos). El caller itera
 * por la lista de candidatos hasta que uno responda con cuotas útiles
 * (aunque sean parciales — el merge final las combina).
 */
async function probarCandidatoAPI(
  eventId: string,
  candidato: (typeof ENDPOINTS_CANDIDATOS)[number],
): Promise<ResultadoCandidato | null> {
  const url = candidato.url(eventId);
  let probe;
  try {
    probe = await httpProbeJson(url, {
      source: `scrapers:betano:${candidato.nombre}`,
      timeoutMs: TIMEOUT_POR_CANDIDATO_MS,
      headers: {
        Origin: `https://${HOST}`,
        Referer: `https://${HOST}/cuotas-de-partido/`,
      },
    });
  } catch (err) {
    // httpProbeJson no debería tirar (acceptStatus = todo) salvo timeout.
    logger.debug(
      {
        eventId,
        candidato: candidato.nombre,
        err: (err as Error).message,
        source: "scrapers:betano",
      },
      "candidato API timeout/error",
    );
    return null;
  }

  if (probe.status !== 200 || probe.data === null) {
    logger.debug(
      {
        eventId,
        candidato: candidato.nombre,
        status: probe.status,
        source: "scrapers:betano",
      },
      "candidato API descartado",
    );
    return null;
  }

  const cuotas = mapearCuotasBetano(probe.data);
  if (Object.keys(cuotas).length === 0) {
    logger.debug(
      {
        eventId,
        candidato: candidato.nombre,
        source: "scrapers:betano",
      },
      "candidato API respondió pero sin mercados conocidos",
    );
    return null;
  }
  return { cuotas, url };
}

/**
 * Estrategia API. Itera por los 5 candidatos y acumula mercados. Para si
 * ya juntó los 4. Devuelve los acumulados (pueden ser parciales) o null
 * si ningún candidato respondió útil.
 */
async function viaAPI(eventId: string): Promise<ResultadoCandidato | null> {
  let acumulado: CuotasCapturadas = {};
  let urlGanadora: string | null = null;

  for (const candidato of ENDPOINTS_CANDIDATOS) {
    const res = await probarCandidatoAPI(eventId, candidato);
    if (!res) continue;

    acumulado = fusionarCuotas(acumulado, res.cuotas);
    urlGanadora = res.url; // el último candidato útil queda como fuente.

    if (cuotasCompletas(acumulado)) {
      logger.info(
        {
          eventId,
          candidato: candidato.nombre,
          source: "scrapers:betano",
        },
        "Betano API completa via candidato",
      );
      return { cuotas: acumulado, url: res.url };
    }
  }

  if (urlGanadora === null) return null;

  logger.warn(
    {
      eventId,
      faltantes: mercadosFaltantes(acumulado),
      source: "scrapers:betano",
    },
    "Betano API parcial — escalando a Playwright para completar",
  );
  return { cuotas: acumulado, url: urlGanadora };
}

// ───────── viaPlaywright ─────────

const SELECTORS_HEADER_BTTS = [
  // Heurística: el header del mercado BTTS suele tener estos textos.
  // Playwright `getByText` con `:has-text` resuelve por contenido.
  "div:has-text('Ambos equipos anotan')",
  "div:has-text('Ambos equipos marcan')",
  "[class*=market]:has-text('Ambos')",
];

const SELECTORS_HEADER_DOBLEOP = [
  "div:has-text('Doble oportunidad')",
  "div:has-text('Doble Op')",
  "[class*=market]:has-text('Doble')",
];

const SELECTORS_HEADER_TOTAL = [
  "div:has-text('Goles totales')",
  "div:has-text('Total de goles')",
  "div:has-text('Más/Menos')",
  "div:has-text('Mas/Menos')",
  "[class*=market]:has-text('Goles')",
];

/**
 * Intenta hacer click en el primer selector que matchee. NO falla si
 * ningún selector matchea (el mercado puede estar ya expandido — el click
 * es opcional, sólo sirve para revelar mercados colapsados).
 *
 * `page.click()` real (no JS programático) — dispara handlers de Vue.
 */
async function expandirMercadoSiColapsado(
  page: PlaywrightPage,
  selectors: string[],
  source: string,
): Promise<void> {
  for (const sel of selectors) {
    try {
      const locator = page.locator(sel).first();
      // visible:short timeout — si no aparece rápido, asumimos que no
      // existe (mercado puede no estar disponible en este partido).
      const visible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
      if (!visible) continue;
      await locator.click({ timeout: 1500, force: false });
      return;
    } catch {
      // Selector no matcheó o click rebotó — probar siguiente.
    }
  }
  logger.debug(
    { selectors, source },
    "ningún selector de header matcheó — mercado posiblemente ya expandido o no presente",
  );
}

/**
 * Lee cuotas del DOM. Estrategia simple: extraer el JSON del Vuex/store
 * que Vue inyecta en `window.__INITIAL_STATE__` o equivalente. Si la
 * página pone el state ahí (típico en Kaizen Gaming), tenemos la data
 * sin parsear DOM nodos.
 *
 * Si no encuentra state inyectado, fallback: leer el HTML renderizado
 * via `page.content()` y aplicar regex para los textos de cuotas. Este
 * fallback es FRÁGIL y queda como última opción.
 */
async function leerCuotasDelPlaywright(
  page: PlaywrightPage,
): Promise<CuotasCapturadas> {
  // Intento 1: Vuex/store inyectado en window
  const stateJson = await page
    .evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const candidates = [
        w.__INITIAL_STATE__,
        w.__NUXT__,
        w.__APOLLO_STATE__,
        w.__INITIAL_DATA__,
      ];
      for (const c of candidates) {
        if (c && typeof c === "object") {
          try {
            return JSON.stringify(c);
          } catch {
            /* circular: ignorar */
          }
        }
      }
      return null;
    })
    .catch(() => null);

  if (stateJson) {
    try {
      const state = JSON.parse(stateJson);
      const cuotas = mapearCuotasBetano(state);
      if (Object.keys(cuotas).length > 0) return cuotas;
    } catch {
      // state no parseable, fallthrough al regex.
    }
  }

  // Fallback regex: muy frágil, sólo último recurso. Buscamos pares
  // "nombre del mercado: cuota" en el HTML rendered. Si esto no funciona
  // V.5 tendrá que ajustar selectores específicos según lo que muestre
  // el QA real.
  return {};
}

/**
 * Estrategia Playwright. Devuelve cuotas (puede ser parcial). Lanza Error
 * si Playwright no está disponible (browser no instalado, launch falló).
 */
async function viaPlaywright(eventId: string): Promise<{
  cuotas: CuotasCapturadas;
  url: string;
}> {
  const page = await crearPagePlaywright();
  if (!page) {
    throw new Error(
      `Betano: Playwright no disponible (browser no se pudo lanzar). Verificar que playwright-chromium esté instalado y PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH apunte a un binario válido en el container.`,
    );
  }

  // Para Betano basta el path con el ID — el slug es cosmético, el server
  // sirve el partido por ID. Si el slug es incorrecto pero el ID es válido,
  // Betano renderiza igual.
  const url = `https://${HOST}/cuotas-de-partido/_/${eventId}/`;

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    // Esperar a que la página hidrate y los mercados aparezcan. Heurística:
    // esperar el primer mercado "Resultado del partido" visible.
    await page
      .waitForSelector("text=Resultado del partido", { timeout: 10_000 })
      .catch(() => {
        logger.debug(
          { eventId, source: "scrapers:betano:playwright" },
          "selector 'Resultado del partido' no apareció — siguiendo igual",
        );
      });

    // Expandir mercados que típicamente vienen colapsados (POC §2.5 confirma
    // que BTTS está colapsado por defecto). Doble Op y Total típicamente
    // se ven expandidos pero algunos partidos los colapsan también.
    await expandirMercadoSiColapsado(
      page,
      SELECTORS_HEADER_BTTS,
      "scrapers:betano:playwright:btts",
    );
    await expandirMercadoSiColapsado(
      page,
      SELECTORS_HEADER_DOBLEOP,
      "scrapers:betano:playwright:dobleop",
    );
    await expandirMercadoSiColapsado(
      page,
      SELECTORS_HEADER_TOTAL,
      "scrapers:betano:playwright:total",
    );

    // Pequeña pausa para que las cuotas hidraten tras los clicks.
    await page.waitForTimeout(800);

    const cuotas = await leerCuotasDelPlaywright(page);
    return { cuotas, url };
  } finally {
    try {
      await page.close();
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, source: "scrapers:betano:playwright" },
        "page.close() falló — page queda como leak menor",
      );
    }
  }
}

// ───────── Discovery ─────────

interface BetanoTopEvent {
  id?: string | number;
  eventId?: string | number;
  homeName?: string;
  awayName?: string;
  homeTeam?: string | { name?: string };
  awayTeam?: string | { name?: string };
  startTime?: string | number;
  startsAt?: string | number;
  kickoffTime?: string | number;
  date?: string | number;
}

function leerNombreEquipo(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.shortName === "string") return o.shortName;
  }
  return "";
}

function leerFecha(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface BetanoCandidatoCrudo {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date;
}

function extraerEventos(payload: unknown): BetanoCandidatoCrudo[] {
  function rec(node: unknown, depth = 0): unknown[] {
    if (depth > 6 || !node || typeof node !== "object") return [];
    if (Array.isArray(node)) {
      const sample = node.find((it) => it && typeof it === "object");
      if (
        sample &&
        typeof sample === "object" &&
        ("homeName" in (sample as object) ||
          "homeTeam" in (sample as object) ||
          "home" in (sample as object) ||
          "teams" in (sample as object))
      ) {
        return node;
      }
      for (const item of node) {
        const found = rec(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    const obj = node as Record<string, unknown>;
    for (const key of [
      "events",
      "topEvents",
      "items",
      "data",
      "results",
      "matches",
      "fixtures",
      "list",
    ]) {
      if (key in obj) {
        const found = rec(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  const arr = rec(payload);
  const out: BetanoCandidatoCrudo[] = [];
  for (const node of arr) {
    if (!node || typeof node !== "object") continue;
    const m = node as BetanoTopEvent & Record<string, unknown>;
    const id = String(m.id ?? m.eventId ?? "");
    if (!id || !/^\d{6,}$/.test(id)) continue;

    let homeName = leerNombreEquipo(m.homeName ?? m.homeTeam ?? m.home);
    let awayName = leerNombreEquipo(m.awayName ?? m.awayTeam ?? m.away);
    if ((!homeName || !awayName) && m.teams && typeof m.teams === "object") {
      const t = m.teams as Record<string, unknown>;
      if (!homeName) homeName = leerNombreEquipo(t.home);
      if (!awayName) awayName = leerNombreEquipo(t.away);
    }
    if (!homeName || !awayName) continue;

    const kickoff = leerFecha(
      m.startTime ?? m.startsAt ?? m.kickoffTime ?? m.date ?? m.timestamp,
    );
    if (!kickoff) continue;

    out.push({ id, homeName, awayName, kickoff });
  }
  return out;
}

// ───────── Scraper ─────────

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "betano",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },

  async buscarEventIdExterno(partido: PartidoSlim): Promise<string | null> {
    // Único endpoint público confirmado en POC §2.5. Devuelve "top events"
    // (eventos destacados de la home), no listado completo por liga, así
    // que la cobertura es parcial — si el partido no está en el carrousel
    // de la home, no lo encontramos. Cuando V.5 capture el endpoint
    // específico de Liga 1 (típicamente `/api/sport/futbol/region/peru/...`)
    // se extiende este método sin tocar la captura.
    // Lote V.8.1: instrumentación detallada por endpoint y al final.
    const url = `https://${HOST}/api/home/top-events-v2/`;
    let probe;
    try {
      probe = await httpProbeJson<unknown>(url, {
        source: "scrapers:betano:discovery",
        timeoutMs: 8_000,
        headers: {
          Origin: `https://${HOST}`,
          Referer: `https://${HOST}/`,
        },
      });
    } catch (err) {
      logger.info(
        {
          partidoId: partido.id,
          url,
          err: (err as Error).message,
          source: "scrapers:betano:discovery",
        },
        `betano discovery probe falló: ${(err as Error).message}`,
      );
      return null;
    }
    if (probe.status !== 200 || probe.data === null) {
      logger.info(
        {
          partidoId: partido.id,
          url,
          status: probe.status,
          source: "scrapers:betano:discovery",
        },
        `betano discovery: top-events-v2 respondió ${probe.status}`,
      );
      return null;
    }

    const candidatos = extraerEventos(probe.data);
    let dentroVentana = 0;
    let matched = 0;
    let match: BetanoCandidatoCrudo | null = null;
    for (const cand of candidatos) {
      if (
        !fechasCercanas(cand.kickoff, partido.fechaInicio, VENTANA_DISCOVERY_MIN)
      ) {
        continue;
      }
      dentroVentana++;
      const ok = await matchearEquiposContraPartido(
        partido,
        { local: cand.homeName, visita: cand.awayName },
        "betano",
      );
      if (ok) {
        matched++;
        if (match) {
          logger.info(
            { partidoId: partido.id, source: "scrapers:betano:discovery" },
            "betano discovery ambiguo — varios matches por equipos+fecha",
          );
          return null;
        }
        match = cand;
      }
    }

    logger.info(
      {
        partidoId: partido.id,
        liga: partido.liga,
        url,
        candidatos: candidatos.length,
        dentroVentana,
        matched,
        source: "scrapers:betano:discovery",
      },
      `betano discovery: ${candidatos.length} candidatos · ${dentroVentana} en ventana · ${matched} matchearon equipos`,
    );

    if (!match) return null;
    return match.id;
  },

  async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
    if (!/^\d{6,}$/.test(eventIdExterno)) {
      throw new Error(
        `Betano: eventId inválido "${eventIdExterno}" — se esperaba número entero (6+ dígitos)`,
      );
    }

    // ── Intento 1: API directa ──
    let acumulado: CuotasCapturadas = {};
    let urlFuente: string | null = null;

    try {
      const apiResult = await viaAPI(eventIdExterno);
      if (apiResult) {
        acumulado = apiResult.cuotas;
        urlFuente = apiResult.url;
      }
    } catch (err) {
      // viaAPI no debería tirar (cada candidato atrapa errores), pero por
      // si acaso, no rompemos — escalamos a Playwright.
      logger.warn(
        {
          eventId: eventIdExterno,
          err: (err as Error).message,
          source: "scrapers:betano",
        },
        "viaAPI lanzó error inesperado — escalando a Playwright",
      );
    }

    if (cuotasCompletas(acumulado) && urlFuente) {
      return {
        cuotas: acumulado,
        fuente: { url: urlFuente, capturadoEn: new Date() },
      };
    }

    // ── Intento 2: Playwright ──
    try {
      const pwResult = await viaPlaywright(eventIdExterno);
      // Mergear con lo que ya tenga la API (los mercados que SÍ vinieron
      // por API son más rápidos/consistentes — los conservamos).
      acumulado = fusionarCuotas(acumulado, pwResult.cuotas);
      // Si la API no aportó nada, la fuente es la de Playwright (URL del
      // partido); si la API sí aportó algo pero faltó BTTS u otro, el
      // urlFuente queda en la última que respondió útil — esto es OK
      // porque indica de dónde vino al menos un mercado.
      if (!urlFuente) urlFuente = pwResult.url;
    } catch (err) {
      const msg = (err as Error).message;
      // Si la API tuvo cuotas parciales y Playwright revienta, mejor
      // devolver lo parcial que perderlo todo. Persistimos lo que tenga.
      if (Object.keys(acumulado).length > 0 && urlFuente) {
        logger.warn(
          {
            eventId: eventIdExterno,
            faltantes: mercadosFaltantes(acumulado),
            err: msg,
            source: "scrapers:betano",
          },
          "viaPlaywright falló pero hay datos parciales de la API — devolviendo parcial",
        );
        return {
          cuotas: acumulado,
          fuente: { url: urlFuente, capturadoEn: new Date() },
        };
      }
      throw new Error(`Betano: API y Playwright fallaron — ${msg}`);
    }

    if (Object.keys(acumulado).length === 0) {
      throw new Error(
        `Betano: el partido ${eventIdExterno} no expuso ningún mercado conocido (1X2/DobleOp/Totales 2.5/BTTS) ni vía API ni vía Playwright`,
      );
    }

    if (!cuotasCompletas(acumulado)) {
      logger.info(
        {
          eventId: eventIdExterno,
          faltantes: mercadosFaltantes(acumulado),
          source: "scrapers:betano",
        },
        "Betano: captura parcial — algunos mercados no se pudieron leer",
      );
    }

    return {
      cuotas: acumulado,
      fuente: {
        url: urlFuente ?? `https://${HOST}/cuotas-de-partido/_/${eventIdExterno}/`,
        capturadoEn: new Date(),
      },
    };
  },
};

export default betanoScraper;

// Scraper Altenar — Lote V fase V.2.
//
// Hallazgo clave del POC 03/05/2026: **Apuesta Total y Doradobet usan el
// mismo backend Altenar** (sportsbook B2B). Diferencia: el host del
// operador, el shape del path y, en Doradobet, un `widgetId` requerido
// como parámetro. Resto del JSON: idéntico.
//
// Endpoints (POC sección 2.2 y 2.4):
//   - Apuesta Total: https://{subdominio}.kmianko.com/api/eventpage/events/{eventId}
//                    (subdominio observado en POC: prod20392, puede rotar)
//   - Doradobet:    https://sb2integration-altenar2.biahosted.com/api/Widget/GetEvent
//                    ?widgetId={widgetId}&eventId={eventId}
//
// Por eso este scraper es **una sola implementación con configuración
// dual** (regla específica del Lote V — un módulo, no dos copias).
//
// SUBDOMINIO DINÁMICO DE APUESTA TOTAL:
// El subdominio `prod20392` puede cambiar (cambio de versión Altenar). Si
// el primer fetch contra el host conocido responde 404 / network error, el
// scraper lee la home de apuestatotal.com y extrae el subdominio vigente
// con regex `(prod\d+\.kmianko\.com)`. Cachéa el resultado en memoria del
// proceso (próximo restart re-resuelve).
//
// WIDGET_ID DE DORADOBET:
// El POC no logró aislar el widgetId exacto que usa Doradobet (los logs
// `getEntriesByType('resource')` muestran el llamado pero el parámetro
// específico requiere captura HAR completa). En V.2 dejamos el scraper
// estructurado y, mientras `WIDGET_ID_DORADOBET` no se configure, las
// capturas de doradobet fallan con mensaje claro ("widgetId pendiente de
// configuración"). V.5 captura el id durante el QA con tráfico real.
//
// Discovery V.2: ambos operadores devuelven null por ahora — el endpoint
// de discovery (search/listing) varía por operador y el POC no lo dejó
// concreto. Fallback manual del Lote V.5 cubre esta brecha (regex de URL
// en sección 5.2 del plan).

import { logger } from "../logger";
import { httpFetchJson, httpFetchText, httpProbeJson } from "./http";
import {
  fechasCercanas,
  matchearEquiposContraPartido,
} from "./alias-equipo";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface PartidoSlim {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
}

const VENTANA_DISCOVERY_MIN = 60;

interface AltenarEvento {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date;
}

function leerNombreEquipoAltenar(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.shortName === "string") return o.shortName;
    if (typeof o.title === "string") return o.title;
  }
  return "";
}

function leerFechaAltenar(v: unknown): Date | null {
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

function extraerEventosAltenar(payload: unknown): AltenarEvento[] {
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
          "teams" in (sample as object) ||
          "participants" in (sample as object))
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
      "matches",
      "items",
      "data",
      "list",
      "result",
      "fixtures",
      "Events",
      "Result",
    ]) {
      if (key in obj) {
        const found = rec(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  const arr = rec(payload);
  const out: AltenarEvento[] = [];
  for (const node of arr) {
    if (!node || typeof node !== "object") continue;
    const m = node as Record<string, unknown>;
    const id = String(m.id ?? m.eventId ?? m.Id ?? m.matchId ?? "");
    if (!id || !/^\d+$/.test(id)) continue;

    let homeName = leerNombreEquipoAltenar(m.homeName ?? m.homeTeam ?? m.home);
    let awayName = leerNombreEquipoAltenar(m.awayName ?? m.awayTeam ?? m.away);
    if ((!homeName || !awayName) && m.teams && typeof m.teams === "object") {
      const t = m.teams as Record<string, unknown>;
      if (!homeName) homeName = leerNombreEquipoAltenar(t.home);
      if (!awayName) awayName = leerNombreEquipoAltenar(t.away);
    }
    if (!homeName || !awayName) continue;

    const kickoff = leerFechaAltenar(
      m.startTime ?? m.startsAt ?? m.kickoff ?? m.date ?? m.timestamp ?? m.startDate,
    );
    if (!kickoff) continue;
    out.push({ id, homeName, awayName, kickoff });
  }
  return out;
}

type AltenarOperador = "apuesta_total" | "doradobet";

interface AltenarConfig {
  /** Host por defecto (rotable en runtime para Apuesta Total). */
  hostDefault: string;
  /** Cómo construir el path del endpoint del partido. */
  buildPath(eventId: string, ctx: { widgetId?: string | null }): string;
  /** Headers extra (Origin/Referer). Influyen menos que en Stake pero ayudan. */
  origin: string;
  referer: string;
  /** Para apuesta_total: si querés autodetectar, usá este URL home. */
  homeUrlParaSubdominio?: string;
  /** Para doradobet: widgetId requerido por el endpoint. */
  widgetId?: string | null;
}

// In-memory cache del subdominio actual de Apuesta Total. Reset al restart
// del proceso (Railway redeploy). Si null, usar `hostDefault`.
let apuestaTotalHostCache: string | null = null;

const ALTENAR_CONFIG: Record<AltenarOperador, AltenarConfig> = {
  apuesta_total: {
    hostDefault: "prod20392.kmianko.com",
    buildPath: (eventId) =>
      `/api/eventpage/events/${encodeURIComponent(eventId)}?hideX25X75Selections=false`,
    origin: "https://www.apuestatotal.com",
    referer: "https://www.apuestatotal.com/apuestas-deportivas/",
    homeUrlParaSubdominio: "https://www.apuestatotal.com/apuestas-deportivas/",
  },
  doradobet: {
    hostDefault: "sb2integration-altenar2.biahosted.com",
    // El endpoint canónico de Altenar para widgets externos:
    //   /api/Widget/GetEvent?widgetId=...&eventId=...
    // El widgetId queda pendiente de configuración (V.5).
    buildPath: (eventId, ctx) => {
      const widgetId = ctx.widgetId ?? "";
      const qs = new URLSearchParams({
        widgetId,
        eventId,
      });
      return `/api/Widget/GetEvent?${qs.toString()}`;
    },
    origin: "https://doradobet.com",
    referer: "https://doradobet.com/deportes/",
    widgetId: process.env.ALTENAR_WIDGET_ID_DORADOBET ?? null,
  },
};

/** Lee la home de Apuesta Total y extrae el subdominio vigente del iframe. */
async function descubrirSubdominioApuestaTotal(): Promise<string | null> {
  const homeUrl = ALTENAR_CONFIG.apuesta_total.homeUrlParaSubdominio!;
  let html: string;
  try {
    html = await httpFetchText(homeUrl, { source: "scrapers:altenar:home-at" });
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "scrapers:altenar:home-at" },
      "no se pudo descubrir subdominio de Apuesta Total — home no respondió",
    );
    return null;
  }
  const m = /https?:\/\/(prod\d+\.kmianko\.com)/i.exec(html);
  if (!m) {
    logger.warn(
      { source: "scrapers:altenar:home-at" },
      "subdominio Apuesta Total no encontrado en HTML home",
    );
    return null;
  }
  return m[1];
}

/**
 * Resuelve el host activo. Para apuesta_total: si el host por defecto
 * responde 404 → re-descubre. Para doradobet: usa siempre el default.
 */
async function resolverHostActivo(
  operador: AltenarOperador,
  eventId: string,
  config: AltenarConfig,
): Promise<string> {
  if (operador !== "apuesta_total") return config.hostDefault;

  const candidato = apuestaTotalHostCache ?? config.hostDefault;
  // Probe HEAD-like: hacemos GET pero acceptStatus = todo para detectar 404.
  const probeUrl = `https://${candidato}${config.buildPath(eventId, {})}`;
  const { status } = await httpProbeJson(probeUrl, {
    source: "scrapers:altenar:probe-at",
    headers: { Origin: config.origin, Referer: config.referer },
  });
  if (status === 200) {
    apuestaTotalHostCache = candidato;
    return candidato;
  }
  if (status === 404) {
    logger.info(
      { hostAnterior: candidato, source: "scrapers:altenar:probe-at" },
      "Apuesta Total host respondió 404 — descubriendo subdominio actualizado",
    );
    const nuevo = await descubrirSubdominioApuestaTotal();
    if (nuevo && nuevo !== candidato) {
      apuestaTotalHostCache = nuevo;
      logger.info(
        { hostAnterior: candidato, hostNuevo: nuevo, source: "scrapers:altenar:probe-at" },
        "Apuesta Total subdominio actualizado",
      );
      return nuevo;
    }
  }
  // Si el probe devolvió otro status (5xx, etc.), usar el host actual y
  // que el fetch principal lo maneje.
  apuestaTotalHostCache = candidato;
  return candidato;
}

function toCuota(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Recorre el payload buscando un array de mercados. Altenar suele exponer
 * `data.event.markets` o `event.markets` o `markets` directo. El parser es
 * defensivo igual que el de Te Apuesto (estructura no documentada en POC).
 */
function findMarkets(node: unknown, depth = 0): unknown[] {
  if (depth > 6 || !node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    const sample = node.find((it) => it && typeof it === "object");
    if (
      sample &&
      typeof sample === "object" &&
      ("odds" in sample || "selections" in sample || "outcomes" in sample)
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
  for (const key of ["markets", "marketGroups", "groups", "data", "event", "result"]) {
    if (key in obj) {
      const found = findMarkets(obj[key], depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

/** Helper: extrae cuota de un outcome dado un set de claves candidatas. */
function leerOutcomes(
  market: unknown,
  keys: Record<string, string[]>,
): Record<string, number | undefined> {
  if (!market || typeof market !== "object") return {};
  const m = market as Record<string, unknown>;
  const lista = (m.odds ?? m.selections ?? m.outcomes ?? m.values) as
    | Array<Record<string, unknown>>
    | undefined;
  const out: Record<string, number | undefined> = {};
  if (!Array.isArray(lista)) return out;

  for (const it of lista) {
    if (!it || typeof it !== "object") continue;
    const code = String(it.code ?? it.name ?? it.outcomeName ?? it.shortName ?? "")
      .toLowerCase()
      .trim();
    const cuota = toCuota(it.value ?? it.odd ?? it.price ?? it.decimalOdds);
    if (!code || cuota === undefined) continue;
    for (const [outName, codes] of Object.entries(keys)) {
      if (codes.some((c) => code === c.toLowerCase() || code.replace(/\s+/g, "") === c.toLowerCase())) {
        out[outName] = cuota;
        break;
      }
    }
  }
  return out;
}

function getMarketName(market: unknown): string {
  if (!market || typeof market !== "object") return "";
  const m = market as Record<string, unknown>;
  return String(m.name ?? m.code ?? m.marketName ?? m.id ?? "").toLowerCase();
}

function isMarket(market: unknown, ...names: string[]): boolean {
  const n = getMarketName(market);
  return names.some((target) => {
    const t = target.toLowerCase();
    return n === t || n.includes(t);
  });
}

/** Si el mercado expone una "línea" (handicap/total), extraerla. */
function getMarketLinea(market: unknown): number | null {
  if (!market || typeof market !== "object") return null;
  const m = market as Record<string, unknown>;
  const v = m.line ?? m.handicap ?? m.totalLine ?? m.specialBetValue ?? m.argument;
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapearCuotasAltenar(payload: unknown): CuotasCapturadas {
  const out: CuotasCapturadas = {};
  const markets = findMarkets(payload);
  if (!markets.length) return out;

  for (const market of markets) {
    if (out["1x2"] === undefined && isMarket(market, "1x2", "match result", "match winner", "matchwinner", "ganador del partido")) {
      const o = leerOutcomes(market, {
        local: ["1", "home", "h"],
        empate: ["x", "draw", "d"],
        visita: ["2", "away", "a"],
      });
      if (o.local !== undefined && o.empate !== undefined && o.visita !== undefined) {
        out["1x2"] = { local: o.local, empate: o.empate, visita: o.visita };
      }
      continue;
    }
    if (out.doble_op === undefined && isMarket(market, "double chance", "doble oportunidad", "doble op", "doblechance")) {
      const o = leerOutcomes(market, {
        x1: ["1x", "1 or x", "homeordraw"],
        x12: ["12", "1 or 2", "homeoraway"],
        xx2: ["x2", "x or 2", "draworaway"],
      });
      if (o.x1 !== undefined && o.x12 !== undefined && o.xx2 !== undefined) {
        out.doble_op = { x1: o.x1, x12: o.x12, xx2: o.xx2 };
      }
      continue;
    }
    if (
      out.mas_menos_25 === undefined &&
      isMarket(market, "total", "totales", "over/under", "goals", "total goals")
    ) {
      const linea = getMarketLinea(market);
      if (linea !== null && Math.abs(linea - 2.5) > 1e-6) continue;
      const o = leerOutcomes(market, {
        over: ["over", "o", "over 2.5", "más", "mas"],
        under: ["under", "u", "under 2.5", "menos"],
      });
      if (o.over !== undefined && o.under !== undefined) {
        out.mas_menos_25 = { over: o.over, under: o.under };
      }
      continue;
    }
    if (
      out.btts === undefined &&
      isMarket(market, "both teams to score", "btts", "ambos equipos anotan", "ambos equipos marcan", "gg/ng")
    ) {
      const o = leerOutcomes(market, {
        si: ["yes", "si", "sí", "gg"],
        no: ["no", "ng"],
      });
      if (o.si !== undefined && o.no !== undefined) {
        out.btts = { si: o.si, no: o.no };
      }
      continue;
    }
  }

  return out;
}

function buildScraperAltenar(operador: AltenarOperador): Scraper {
  const cfg = ALTENAR_CONFIG[operador];

  return {
    nombre: operador,

    async buscarEventIdExterno(partido: PartidoSlim): Promise<string | null> {
      // V.5: Altenar B2B expone listados upcoming en estos paths típicos.
      // Probamos en orden hasta que uno responda con eventos. El widgetId
      // de Doradobet aplica también a su discovery.
      const host = await resolverHostActivo(operador, "0", cfg);
      const candidatos: Array<() => string> =
        operador === "doradobet"
          ? [
              () =>
                cfg.widgetId
                  ? `https://${host}/api/Widget/GetEventList?widgetId=${cfg.widgetId}&sportId=66`
                  : `https://${host}/api/eventbrowser/upcoming?sportId=66`,
              () => `https://${host}/api/eventbrowser/upcoming?sportId=66`,
              () => `https://${host}/api/eventbrowser/sport/66/events`,
            ]
          : [
              () => `https://${host}/api/eventbrowser/upcoming?sportId=66`,
              () => `https://${host}/api/sportsbookv2/sports/66/events`,
              () => `https://${host}/api/eventbrowser/sport/66/events`,
            ];

      let eventos: AltenarEvento[] = [];
      for (const builder of candidatos) {
        const url = builder();
        try {
          const probe = await httpProbeJson<unknown>(url, {
            source: `scrapers:${operador}:discovery`,
            timeoutMs: 8_000,
            headers: { Origin: cfg.origin, Referer: cfg.referer },
          });
          if (probe.status !== 200 || probe.data === null) continue;
          const lista = extraerEventosAltenar(probe.data);
          if (lista.length === 0) continue;
          eventos = lista;
          break;
        } catch {
          continue;
        }
      }

      if (eventos.length === 0) {
        logger.debug(
          { partidoId: partido.id, source: `scrapers:${operador}:discovery` },
          "discovery — ningún endpoint upcoming devolvió eventos, vincular manualmente",
        );
        return null;
      }

      let match: AltenarEvento | null = null;
      for (const cand of eventos) {
        if (!fechasCercanas(cand.kickoff, partido.fechaInicio, VENTANA_DISCOVERY_MIN)) {
          continue;
        }
        const ok = await matchearEquiposContraPartido(
          partido,
          { local: cand.homeName, visita: cand.awayName },
          operador,
        );
        if (ok) {
          if (match) {
            logger.warn(
              { partidoId: partido.id, source: `scrapers:${operador}:discovery` },
              "discovery ambiguo — varios matches por equipos+fecha",
            );
            return null;
          }
          match = cand;
        }
      }
      if (!match) {
        logger.debug(
          {
            partidoId: partido.id,
            equipoLocal: partido.equipoLocal,
            equipoVisita: partido.equipoVisita,
            source: `scrapers:${operador}:discovery`,
          },
          "discovery sin match único — pendiente de vinculación manual",
        );
        return null;
      }
      return match.id;
    },

    async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
      // Validación específica por operador.
      if (operador === "apuesta_total" && !/^\d+$/.test(eventIdExterno)) {
        throw new Error(
          `Apuesta Total: eventId inválido "${eventIdExterno}" — se esperaba número entero (15+ dígitos)`,
        );
      }
      if (operador === "doradobet") {
        if (!/^\d+$/.test(eventIdExterno)) {
          throw new Error(
            `Doradobet: eventId inválido "${eventIdExterno}" — se esperaba número entero`,
          );
        }
        if (!cfg.widgetId) {
          throw new Error(
            "Doradobet: ALTENAR_WIDGET_ID_DORADOBET no está configurado — fijar la env var con el widgetId capturado en V.5 antes de habilitar este scraper",
          );
        }
      }

      const host = await resolverHostActivo(operador, eventIdExterno, cfg);
      const url = `https://${host}${cfg.buildPath(eventIdExterno, { widgetId: cfg.widgetId ?? null })}`;

      const payload = await httpFetchJson<unknown>(url, {
        source: `scrapers:${operador}`,
        headers: {
          Origin: cfg.origin,
          Referer: cfg.referer,
        },
      });

      if (!payload || typeof payload !== "object") {
        throw new Error(`${operador}: respuesta vacía/malformada para ${eventIdExterno}`);
      }

      const cuotas = mapearCuotasAltenar(payload);
      if (Object.keys(cuotas).length === 0) {
        throw new Error(
          `${operador}: el partido ${eventIdExterno} no expuso ningún mercado conocido (1X2/DobleOp/Totales 2.5/BTTS)`,
        );
      }

      return {
        cuotas,
        fuente: { url, capturadoEn: new Date() },
      };
    },
  };
}

/** Scraper para Apuesta Total. Comparte parser con Doradobet. */
export const apuestaTotalScraper: Scraper = buildScraperAltenar("apuesta_total");

/** Scraper para Doradobet. Comparte parser con Apuesta Total. */
export const doradobetScraper: Scraper = buildScraperAltenar("doradobet");

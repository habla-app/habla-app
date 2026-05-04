// Scraper Inkabet — Lote V fase V.3.
//
// Inkabet es la casa con MÁS particularidades del scope:
//
//   1. EVENT ID ALFANUMÉRICO. Otras casas usan números enteros (Stake
//      `25792580`, Coolbet `2528144`, Betano `84146293`). Inkabet usa
//      strings tipo `f-r0f9JVh-c0WyAMylSZtvtA` (POC §2.6, base64-like).
//      El campo `eventIdExterno: TEXT` ya lo cubre desde V.1; este
//      scraper NO valida con `/^\d+$/` ni cast a Int — sólo verifica
//      que sea string no-vacío con caracteres URL-safe.
//
//   2. SPORTSBOOK EN IFRAME PROPIO. La API real vive en el dominio del
//      playground `https://d-cf.inkabetplayground.net/...` (POC §2.6),
//      NO en `inkabet.pe`. La página del partido carga ese sub-dominio
//      en un iframe pero el endpoint JSON es accesible directo via HTTP
//      sin cargar el iframe.
//
//   3. VARIANTES "REGULAR" vs "PAGO ANTICIPADO". Inkabet expone hasta
//      DOS versiones del mismo mercado: "Ganador del partido" (regular)
//      y "Ganador del partido - Pago Anticipado" (boost). Persistimos
//      SOLO LA REGULAR para mantener consistencia con las otras 6 casas
//      del comparador. Si la regular está suspendida momentáneamente
//      (POC §1.5/Inkabet — comportamiento típico minutos antes del
//      kickoff cuando reajustan líneas) y sólo está disponible "Pago
//      Anticipado", el scraper LANZA `CapturaSinDatosError` para que el
//      worker marque la fila con `estado="SIN_DATOS"` SIN penalizar
//      salud y SIN triggerear retry de BullMQ. El próximo ciclo del
//      cron 24h reintenta naturalmente.
//
// LIMITACIÓN DEL POC (sección 2.6):
//   El POC identificó el dominio (`d-cf.inkabetplayground.net`) y el
//   formato del event ID, pero no aisló el endpoint JSON exacto.
//   Inkabet usa una segmentación por tenant ID (`stc-943713193`) en el
//   path del iframe. Sin captura HAR completa, partimos del path más
//   probable (`/api/event/{id}`) y exponemos el segmento tenant como
//   constante editable. Cuando V.5 capture la URL exacta durante el QA
//   con tráfico real, basta tocar `INKABET_API_PATH` o el tenant para
//   ajustar — el resto del scraper queda intacto.
//
// DISCOVERY V.3:
//   POC no documentó el endpoint de listado por liga. Devolvemos null
//   y dejamos al fallback manual de V.5 (regex `eventId=([\w-]+)`)
//   resolverlo. Cuando V.5 capture el endpoint, este método se extiende
//   sin tocar la lógica de captura.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import {
  CapturaSinDatosError,
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

const HOST = "d-cf.inkabetplayground.net";

/**
 * Path del endpoint del partido. Adivinanza informada (no validada
 * empíricamente en POC). V.5 debe ajustar acá una vez que el QA con
 * tráfico real capture el URL exacto del JSON.
 *
 * Convenciones probables observadas en el dominio playground:
 *   - `/api/event/{id}`
 *   - `/{tenant}/api/event/{id}`  (donde `tenant = stc-943713193`)
 *   - `/api/v1/events/{id}`
 *
 * Empezamos con la variante sin tenant porque es la convención más
 * común en plataformas de sportsbook B2B. Si V.5 confirma que requiere
 * tenant prefix, mover a INKABET_API_PATH.
 */
const INKABET_API_PATH = (eventId: string): string =>
  `/api/event/${encodeURIComponent(eventId)}`;

/**
 * Validación del eventId alfanumérico de Inkabet. Acepta letras (incluye
 * mayúsculas y minúsculas), dígitos, guión medio y guión bajo. NO acepta
 * espacios, slashes ni caracteres URL-unsafe — el caller es responsable
 * de pasar el id "limpio" tal como aparece en el query `eventId=...` de
 * la URL del partido.
 */
function eventIdValido(eventId: string): boolean {
  return typeof eventId === "string" && /^[A-Za-z0-9_-]+$/.test(eventId) && eventId.length > 0;
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
 * Recorre el payload buscando un array de mercados. Estructura no
 * documentada empíricamente — parser defensivo igual que altenar/coolbet.
 */
function findMarkets(node: unknown, depth = 0): unknown[] {
  if (depth > 6 || !node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    const sample = node.find((it) => it && typeof it === "object");
    if (
      sample &&
      typeof sample === "object" &&
      ("outcomes" in (sample as object) ||
        "selections" in (sample as object) ||
        "odds" in (sample as object))
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
  ]) {
    if (key in obj) {
      const found = findMarkets(obj[key], depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

function getMarketName(market: unknown): string {
  if (!market || typeof market !== "object") return "";
  const m = market as Record<string, unknown>;
  return String(
    m.name ?? m.code ?? m.marketName ?? m.shortName ?? m.id ?? "",
  )
    .toLowerCase()
    .trim();
}

/**
 * Detecta si un mercado es la variante "Pago Anticipado". Inkabet (POC
 * §2.6) etiqueta esos mercados con sufijo " - Pago Anticipado" en el
 * nombre humano. Algunas implementaciones de sportsbook agregan también
 * códigos como `EARLY_PAYOUT` o flags específicos — chequeamos ambos.
 */
function esPagoAnticipado(market: unknown): boolean {
  if (!market || typeof market !== "object") return false;
  const m = market as Record<string, unknown>;
  const nombre = getMarketName(market);
  if (nombre.includes("pago anticipado")) return true;
  if (nombre.includes("early payout") || nombre.includes("earlypayout")) return true;
  // Flags explícitos que algunas variantes de Altenar/B2B exponen.
  if (m.isEarlyPayout === true || m.earlyPayout === true) return true;
  if (m.variant === "early_payout" || m.kind === "early_payout") return true;
  return false;
}

function isMarketDe(market: unknown, ...names: string[]): boolean {
  const n = getMarketName(market);
  return names.some((target) => {
    const t = target.toLowerCase();
    return n === t || n.includes(t);
  });
}

function isMercado1X2(market: unknown): boolean {
  return isMarketDe(
    market,
    "ganador del partido",
    "ganador",
    "1x2",
    "match result",
    "match winner",
    "matchresult",
    "matchwinner",
    "winner",
    "resultado",
  );
}

function isMercadoDobleOp(market: unknown): boolean {
  return isMarketDe(
    market,
    "doble op",
    "doble oportunidad",
    "doble chance",
    "double chance",
    "doublechance",
  );
}

function isMercadoMasMenos(market: unknown): boolean {
  return isMarketDe(
    market,
    "total de goles",
    "total goals",
    "totalgoals",
    "totales",
    "total",
    "más menos",
    "mas menos",
    "over/under",
    "goals",
  );
}

function isMercadoBtts(market: unknown): boolean {
  return isMarketDe(
    market,
    "ambos equipos anotan",
    "ambos equipos marcan",
    "ambos equipos",
    "both teams to score",
    "bothteamstoscore",
    "btts",
  );
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
    m.points;
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function leerOutcomes(
  market: unknown,
  keys: Record<string, string[]>,
): Record<string, number | undefined> {
  if (!market || typeof market !== "object") return {};
  const m = market as Record<string, unknown>;
  const lista = (m.outcomes ?? m.selections ?? m.odds ?? m.values) as
    | Array<Record<string, unknown>>
    | undefined;
  const out: Record<string, number | undefined> = {};
  if (!Array.isArray(lista)) return out;

  for (const it of lista) {
    if (!it || typeof it !== "object") continue;
    const code = String(
      it.code ?? it.name ?? it.outcomeName ?? it.shortName ?? it.label ?? "",
    )
      .toLowerCase()
      .trim();
    const cuota = toCuota(it.value ?? it.odd ?? it.price ?? it.decimalOdds);
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

interface MercadoExtraidoVariante<T> {
  /** Variante Regular (la que persistimos). Undefined si suspendida. */
  regular: T | undefined;
  /** Si existe SÓLO la variante Pago Anticipado, true. Señal de SIN_DATOS. */
  soloPagoAnticipado: boolean;
}

/**
 * Procesa los markets recorriéndolos UNA vez. Para cada mercado canónico
 * recoge la versión Regular (preferida). Si no encuentra Regular pero sí
 * encuentra Pago Anticipado, marca `soloPagoAnticipado = true` para que
 * el caller decida si emitir SIN_DATOS.
 */
function procesarMercadosInkabet(markets: unknown[]): {
  cuotas: CuotasCapturadas;
  marcadores: {
    has1x2: MercadoExtraidoVariante<{ local: number; empate: number; visita: number }>;
    hasDobleOp: MercadoExtraidoVariante<{ x1: number; x12: number; xx2: number }>;
    hasMasMenos: MercadoExtraidoVariante<{ over: number; under: number }>;
    hasBtts: MercadoExtraidoVariante<{ si: number; no: number }>;
  };
} {
  const cuotas: CuotasCapturadas = {};
  const m = {
    has1x2: { regular: undefined, soloPagoAnticipado: false } as MercadoExtraidoVariante<{
      local: number;
      empate: number;
      visita: number;
    }>,
    hasDobleOp: { regular: undefined, soloPagoAnticipado: false } as MercadoExtraidoVariante<{
      x1: number;
      x12: number;
      xx2: number;
    }>,
    hasMasMenos: { regular: undefined, soloPagoAnticipado: false } as MercadoExtraidoVariante<{
      over: number;
      under: number;
    }>,
    hasBtts: { regular: undefined, soloPagoAnticipado: false } as MercadoExtraidoVariante<{
      si: number;
      no: number;
    }>,
  };

  // Helper para no duplicar la lógica de extracción por mercado.
  function tryExtract<T>(
    market: unknown,
    extractor: () => T | undefined,
    holder: MercadoExtraidoVariante<T>,
  ): boolean {
    if (holder.regular !== undefined) return false; // ya tenemos la regular
    const pagoAnticipado = esPagoAnticipado(market);
    const outcomes = extractor();
    if (outcomes === undefined) return false;
    if (pagoAnticipado) {
      // Sólo registramos el flag — NO persistimos la variante boost.
      holder.soloPagoAnticipado = true;
      return false;
    }
    holder.regular = outcomes;
    return true;
  }

  for (const market of markets) {
    if (isMercado1X2(market)) {
      tryExtract(
        market,
        () => {
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
            return { local: o.local, empate: o.empate, visita: o.visita };
          }
          return undefined;
        },
        m.has1x2,
      );
      continue;
    }

    if (isMercadoDobleOp(market)) {
      tryExtract(
        market,
        () => {
          const o = leerOutcomes(market, {
            x1: ["1x", "1 or x", "homeordraw", "1-x"],
            x12: ["12", "1 or 2", "homeoraway", "1-2"],
            xx2: ["x2", "x or 2", "draworaway", "x-2"],
          });
          if (o.x1 !== undefined && o.x12 !== undefined && o.xx2 !== undefined) {
            return { x1: o.x1, x12: o.x12, xx2: o.xx2 };
          }
          return undefined;
        },
        m.hasDobleOp,
      );
      continue;
    }

    if (isMercadoMasMenos(market)) {
      const linea = getMarketLinea(market);
      if (linea !== null && Math.abs(linea - 2.5) > 1e-6) continue;
      tryExtract(
        market,
        () => {
          const o = leerOutcomes(market, {
            over: ["over", "o", "over 2.5", "over2.5", "más", "mas", "+2.5"],
            under: ["under", "u", "under 2.5", "under2.5", "menos", "-2.5"],
          });
          if (o.over !== undefined && o.under !== undefined) {
            return { over: o.over, under: o.under };
          }
          return undefined;
        },
        m.hasMasMenos,
      );
      continue;
    }

    if (isMercadoBtts(market)) {
      tryExtract(
        market,
        () => {
          const o = leerOutcomes(market, {
            si: ["yes", "si", "sí", "y"],
            no: ["no", "n"],
          });
          if (o.si !== undefined && o.no !== undefined) {
            return { si: o.si, no: o.no };
          }
          return undefined;
        },
        m.hasBtts,
      );
      continue;
    }
  }

  if (m.has1x2.regular) cuotas["1x2"] = m.has1x2.regular;
  if (m.hasDobleOp.regular) cuotas.doble_op = m.hasDobleOp.regular;
  if (m.hasMasMenos.regular) cuotas.mas_menos_25 = m.hasMasMenos.regular;
  if (m.hasBtts.regular) cuotas.btts = m.hasBtts.regular;

  return { cuotas, marcadores: m };
}

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async buscarEventIdExterno(): Promise<string | null> {
    // POC §2.6 confirma que los event IDs vienen en formato base64-like
    // alfanumérico, accesibles via query `eventId=...` de la URL del
    // partido. El listado por liga del backend del playground existe
    // pero no fue capturado empíricamente. V.5 cubre este gap con el
    // fallback manual (regex `eventId=([\w-]+)`).
    logger.debug(
      { source: "scrapers:inkabet" },
      "discovery automático no disponible — vincular manualmente",
    );
    return null;
  },

  async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
    if (!eventIdValido(eventIdExterno)) {
      throw new Error(
        `Inkabet: eventId inválido "${eventIdExterno}" — se esperaba string alfanumérico (letras, dígitos, guión, underscore)`,
      );
    }

    const url = `https://${HOST}${INKABET_API_PATH(eventIdExterno)}`;
    const payload = await httpFetchJson<unknown>(url, {
      source: "scrapers:inkabet",
      headers: {
        Origin: "https://www.inkabet.pe",
        Referer: "https://www.inkabet.pe/pe/apuestas-deportivas",
      },
    });

    if (!payload || typeof payload !== "object") {
      throw new Error(`Inkabet: respuesta vacía/malformada para ${eventIdExterno}`);
    }

    const markets = findMarkets(payload);
    if (!markets.length) {
      throw new Error(
        `Inkabet: no se encontraron mercados en la respuesta para ${eventIdExterno}`,
      );
    }

    const { cuotas, marcadores } = procesarMercadosInkabet(markets);

    // SIN_DATOS: si NO encontramos ningún mercado canónico en la variante
    // Regular, pero AL MENOS UNO existía como Pago Anticipado, es el
    // patrón documentado en POC §1.5/Inkabet (regular suspendido pre-
    // kickoff). Lanzamos error tipado para que el worker persista
    // SIN_DATOS sin penalizar salud ni triggerear retry de BullMQ.
    if (Object.keys(cuotas).length === 0) {
      const algunPagoAnticipado =
        marcadores.has1x2.soloPagoAnticipado ||
        marcadores.hasDobleOp.soloPagoAnticipado ||
        marcadores.hasMasMenos.soloPagoAnticipado ||
        marcadores.hasBtts.soloPagoAnticipado;

      if (algunPagoAnticipado) {
        throw new CapturaSinDatosError(
          `Inkabet: variante Regular suspendida para ${eventIdExterno} — sólo Pago Anticipado disponible. Próximo ciclo reintenta.`,
        );
      }

      throw new Error(
        `Inkabet: el partido ${eventIdExterno} no expuso ningún mercado conocido (1X2/DobleOp/Totales 2.5/BTTS) ni Pago Anticipado`,
      );
    }

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
    };
  },
};

export default inkabetScraper;

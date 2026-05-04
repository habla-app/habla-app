// Scraper Coolbet — Lote V fase V.3.
//
// Coolbet es la casa con dos particularidades técnicas que hacen su scraper
// más complejo que Stake/Altenar/Te Apuesto:
//
//   1. WARMUP OBLIGATORIO. El POST a `/s/sb-odds/odds/current/fo` rechaza
//      requests sin la sesión de cookies. Hay que hacer un GET previo a la
//      home `https://www.coolbet.pe/` para que el server emita las cookies
//      de geolocation/anti-bot, capturarlas, y enviarlas en el header
//      `Cookie` de los POSTs subsiguientes. Sin warmup el endpoint
//      responde 503.
//
//   2. ORDEN DE COLUMNAS NO ESTÁNDAR EN DOBLE OPORTUNIDAD. Coolbet
//      devuelve `1X / X2 / 12` (POC §1.5/Coolbet) en lugar del orden
//      `1X / 12 / X2` que usan las otras casas. Si el parser mapeara por
//      posición (índice 0/1/2), las cuotas quedarían cruzadas y todas las
//      alertas de variación serían falsos positivos. **Mapeamos por
//      nombre/código del outcome, no por posición.**
//
// Además:
//
//   - Si el POST devuelve 503, reintento interno con backoff 5s × hasta 3
//     intentos antes de delegar al retry de BullMQ. La razón: BullMQ tiene
//     backoff exponencial con base 2s, y sería 2s/4s/8s — pero un 503 de
//     Coolbet típicamente toma 5-10s en limpiarse. El retry interno cubre
//     ese rango específico.
//   - Endpoint principal: `POST https://www.coolbet.pe/s/sb-odds/odds/current/fo`
//     con body `{eventIds: [eventId]}`.
//   - Event ID: numérico (ej. `2528144` del POC §2.3).
//
// DISCOVERY V.3: el POC no documentó el endpoint público de búsqueda
// usable desde server. Las llamadas observadas (`/s/sports/in-play/find`)
// son para LIVE, no pre-match. Sin endpoint confirmado, devolvemos null
// y dejamos al fallback manual del Lote V.5 (regex `/match/(\d+)`)
// resolverlo. Cuando V.5 capture el endpoint correcto, este método se
// extiende sin tocar el resto.
//
// Coolbet (POC §2.3) llama "Universidad Técnica de Cajamarca" a UTC. El
// matching de equipos resuelve esto vía `AliasEquipo` (Lote V.1).

import { logger } from "../logger";
import { httpFetchJson, httpProbeJson } from "./http";
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

const HOST = "www.coolbet.pe";
const HOME_URL = `https://${HOST}/`;
const ENDPOINT_ODDS = `https://${HOST}/s/sb-odds/odds/current/fo`;

const REINTENTOS_503 = 3;
const BACKOFF_503_MS = 5_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

// Sesión de cookies en memoria del proceso. Coolbet no rota la sesión
// agresivamente — typical lifetime 30+min. Refrescamos cada 25min para
// dejar margen sin saturar la home con GETs innecesarios.
const COOKIE_SESSION_TTL_MS = 25 * 60 * 1000;
let cookieSession: { cookieHeader: string; expiraEn: number } | null = null;

interface CoolbetSetCookieResponse {
  /** Lista plana de cookies "name=value" listas para Cookie header. */
  cookies: string[];
}

/**
 * Hace warmup contra la home de Coolbet y captura `Set-Cookie`. Devuelve
 * la lista de pares `name=value` que se concatenan con `; ` para armar
 * el header `Cookie` en los POSTs.
 *
 * Si la home falla o no emite cookies, devuelve array vacío y deja al
 * caller seguir adelante (algunos POSTs de Coolbet pueden funcionar con
 * cookies parciales o con header de geo header solamente).
 */
async function warmupCoolbet(): Promise<CoolbetSetCookieResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(HOME_URL, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    logger.warn(
      { err: (err as Error).message, source: "scrapers:coolbet:warmup" },
      "warmup Coolbet falló — siguiendo sin cookies",
    );
    return { cookies: [] };
  }
  clearTimeout(timer);

  // res.headers.getSetCookie() está disponible en Node 20+ (engines >=20).
  let setCookies: string[];
  try {
    const headersWithGetSetCookie = res.headers as unknown as {
      getSetCookie?: () => string[];
    };
    setCookies =
      typeof headersWithGetSetCookie.getSetCookie === "function"
        ? headersWithGetSetCookie.getSetCookie()
        : [];
  } catch {
    setCookies = [];
  }

  const cookies = setCookies
    .map((sc) => sc.split(";")[0]!.trim())
    .filter((p) => p.length > 0 && p.includes("="));

  if (cookies.length === 0) {
    logger.warn(
      { status: res.status, source: "scrapers:coolbet:warmup" },
      "warmup Coolbet — home no emitió Set-Cookie",
    );
  }
  return { cookies };
}

async function obtenerCookieHeader(): Promise<string> {
  const ahora = Date.now();
  if (cookieSession && cookieSession.expiraEn > ahora) {
    return cookieSession.cookieHeader;
  }
  const { cookies } = await warmupCoolbet();
  const cookieHeader = cookies.join("; ");
  cookieSession = {
    cookieHeader,
    expiraEn: ahora + COOKIE_SESSION_TTL_MS,
  };
  return cookieHeader;
}

/** Invalida la sesión cacheada — la próxima llamada hace warmup fresco. */
function invalidarSession(): void {
  cookieSession = null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Recorre el payload buscando un array de mercados. Coolbet (GAN Sports)
 * típicamente expone `events[].markets[]` o `result[].markets[]`. Parser
 * defensivo igual que altenar/te-apuesto — el shape exacto del JSON no
 * fue capturado en el POC §2.3 (sólo se confirmó que las cuotas viajan
 * por el endpoint).
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

function isMarket(market: unknown, ...names: string[]): boolean {
  const n = getMarketName(market);
  return names.some((target) => {
    const t = target.toLowerCase();
    return n === t || n.includes(t);
  });
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

/**
 * Lee outcomes de un mercado mapeando POR NOMBRE/CÓDIGO. Crítico para
 * Coolbet: el orden de columnas Doble Op es `1X / X2 / 12` (no estándar).
 * Si el parser leyera por índice, los outcomes quedarían invertidos.
 */
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

function mapearCuotasCoolbet(payload: unknown): CuotasCapturadas {
  const out: CuotasCapturadas = {};
  const markets = findMarkets(payload);
  if (!markets.length) return out;

  for (const market of markets) {
    if (
      out["1x2"] === undefined &&
      isMarket(
        market,
        "match result",
        "match winner",
        "matchresult",
        "matchwinner",
        "winner",
        "1x2",
        "ganador del partido",
        "ganador",
        "resultado",
      )
    ) {
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

    if (
      out.doble_op === undefined &&
      isMarket(
        market,
        "double chance",
        "doublechance",
        "doble oportunidad",
        "doble op",
        "doble chance",
      )
    ) {
      // Mapeo POR NOMBRE — Coolbet expone outcomes con nombres "1X" / "X2"
      // / "12" (en cualquier orden de array). Match por código asegura
      // correctitud independiente del orden.
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

    if (
      out.mas_menos_25 === undefined &&
      isMarket(
        market,
        "total goals",
        "totalgoals",
        "totals",
        "total",
        "totales",
        "goals",
        "over/under",
        "more or less",
      )
    ) {
      const linea = getMarketLinea(market);
      if (linea !== null && Math.abs(linea - 2.5) > 1e-6) continue;
      const o = leerOutcomes(market, {
        over: ["over", "o", "over 2.5", "over2.5", "más", "mas", "+2.5"],
        under: [
          "under",
          "u",
          "under 2.5",
          "under2.5",
          "menos",
          "-2.5",
        ],
      });
      if (o.over !== undefined && o.under !== undefined) {
        out.mas_menos_25 = { over: o.over, under: o.under };
      }
      continue;
    }

    if (
      out.btts === undefined &&
      isMarket(
        market,
        "both teams to score",
        "bothteamstoscore",
        "btts",
        "ambos equipos anotan",
        "ambos equipos marcan",
        "ambos equipos",
      )
    ) {
      const o = leerOutcomes(market, {
        si: ["yes", "si", "sí", "y"],
        no: ["no", "n"],
      });
      if (o.si !== undefined && o.no !== undefined) {
        out.btts = { si: o.si, no: o.no };
      }
      continue;
    }
  }

  return out;
}

interface FetchOddsResult {
  payload: unknown;
  url: string;
}

/**
 * POST al endpoint de odds. Maneja el flujo completo:
 *   - obtiene Cookie header (warmup si cache vencido)
 *   - intenta el POST
 *   - si responde 503: backoff 5s, reintento (×3 max)
 *   - si responde 401/403 (típico de cookie expirada): invalida cache y
 *     reintenta UNA vez con cookie fresca
 *   - si la respuesta no es JSON parseable: lanza
 */
async function fetchOddsConRetry(eventId: string): Promise<FetchOddsResult> {
  let cookieHeader = await obtenerCookieHeader();
  let yaInvalidamosSession = false;

  for (let intento = 1; intento <= REINTENTOS_503; intento++) {
    const { status, data, rawText } = await httpProbeJson(ENDPOINT_ODDS, {
      method: "POST",
      body: { eventIds: [eventId] },
      headers: {
        Origin: `https://${HOST}`,
        Referer: `https://${HOST}/en/sports/match/${encodeURIComponent(eventId)}`,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      source: "scrapers:coolbet",
      timeoutMs: 15_000,
    });

    if (status === 200) {
      if (data === null) {
        throw new Error(
          `Coolbet: respuesta 200 pero body no-JSON para eventId ${eventId} (preview: ${rawText.slice(0, 120)})`,
        );
      }
      return { payload: data, url: ENDPOINT_ODDS };
    }

    if (status === 503) {
      if (intento < REINTENTOS_503) {
        logger.warn(
          {
            eventId,
            intento,
            siguienteEnMs: BACKOFF_503_MS,
            source: "scrapers:coolbet",
          },
          "Coolbet POST odds respondió 503 — backoff y reintento",
        );
        await delay(BACKOFF_503_MS);
        continue;
      }
      throw new Error(
        `Coolbet: 503 persistente tras ${REINTENTOS_503} reintentos (eventId ${eventId})`,
      );
    }

    // 401/403: posible cookie expirada. Invalidar cache y reintentar 1 vez
    // antes de rendirse — sin contar contra el budget de reintentos 503.
    if ((status === 401 || status === 403) && !yaInvalidamosSession) {
      yaInvalidamosSession = true;
      logger.info(
        { eventId, status, source: "scrapers:coolbet" },
        "Coolbet POST odds respondió auth error — refrescando cookies",
      );
      invalidarSession();
      cookieHeader = await obtenerCookieHeader();
      continue;
    }

    throw new Error(
      `Coolbet: POST odds respondió ${status} (eventId ${eventId}, intento ${intento})`,
    );
  }

  // Defensa: el loop debería siempre return o throw antes de llegar acá.
  throw new Error(`Coolbet: retry budget agotado (eventId ${eventId})`);
}

// V.5 — Endpoints de discovery candidato. GAN Sports (backend de Coolbet)
// expone listados pre-match en estos paths típicos. Probamos en orden hasta
// que uno responda con eventos; el resto cae al fallback manual.
const ENDPOINTS_DISCOVERY: Array<() => string> = [
  () => `https://${HOST}/s/sports/v1/upcoming?sportId=1`,
  () => `https://${HOST}/s/sb-odds/odds/upcoming?sportId=1`,
  () => `https://${HOST}/s/sports/in-play/upcoming?sportId=1`,
  () => `https://${HOST}/s/sports/v1/events?sport=football&status=upcoming`,
];

const VENTANA_DISCOVERY_MIN = 60;

interface CoolbetEvento {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date;
}

function leerNombreEquipoCoolbet(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    if (typeof o.shortName === "string") return o.shortName;
    if (typeof o.title === "string") return o.title;
  }
  return "";
}

function leerFechaCoolbet(v: unknown): Date | null {
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

function extraerEventosCoolbet(payload: unknown): CoolbetEvento[] {
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
    ]) {
      if (key in obj) {
        const found = rec(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  const arr = rec(payload);
  const out: CoolbetEvento[] = [];
  for (const node of arr) {
    if (!node || typeof node !== "object") continue;
    const m = node as Record<string, unknown>;
    const id = String(m.id ?? m.eventId ?? m.matchId ?? "");
    if (!id || !/^\d+$/.test(id)) continue;

    let homeName = leerNombreEquipoCoolbet(m.homeName ?? m.homeTeam ?? m.home);
    let awayName = leerNombreEquipoCoolbet(m.awayName ?? m.awayTeam ?? m.away);
    if ((!homeName || !awayName) && m.teams && typeof m.teams === "object") {
      const t = m.teams as Record<string, unknown>;
      if (!homeName) homeName = leerNombreEquipoCoolbet(t.home);
      if (!awayName) awayName = leerNombreEquipoCoolbet(t.away);
    }
    if (!homeName || !awayName) continue;

    const kickoff = leerFechaCoolbet(
      m.startTime ?? m.startsAt ?? m.kickoff ?? m.date ?? m.timestamp,
    );
    if (!kickoff) continue;
    out.push({ id, homeName, awayName, kickoff });
  }
  return out;
}

const coolbetScraper: Scraper = {
  nombre: "coolbet",

  async buscarEventIdExterno(partido: PartidoSlim): Promise<string | null> {
    // V.5: probamos endpoints upcoming candidato. Para evitar 503, hacemos
    // warmup primero (igual que en captura). Si todos los endpoints fallan
    // cae a manual.
    let cookieHeader = "";
    try {
      cookieHeader = await obtenerCookieHeader();
    } catch {
      cookieHeader = "";
    }

    let candidatos: CoolbetEvento[] = [];
    for (const builder of ENDPOINTS_DISCOVERY) {
      const url = builder();
      try {
        const probe = await httpProbeJson<unknown>(url, {
          source: "scrapers:coolbet:discovery",
          timeoutMs: 8_000,
          headers: {
            Origin: `https://${HOST}`,
            Referer: `https://${HOST}/`,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
        if (probe.status !== 200 || probe.data === null) continue;
        const lista = extraerEventosCoolbet(probe.data);
        if (lista.length === 0) continue;
        candidatos = lista;
        break;
      } catch {
        continue;
      }
    }

    if (candidatos.length === 0) {
      logger.debug(
        { partidoId: partido.id, source: "scrapers:coolbet:discovery" },
        "discovery — ningún endpoint upcoming devolvió eventos, vincular manualmente",
      );
      return null;
    }

    let match: CoolbetEvento | null = null;
    for (const cand of candidatos) {
      if (!fechasCercanas(cand.kickoff, partido.fechaInicio, VENTANA_DISCOVERY_MIN)) {
        continue;
      }
      const ok = await matchearEquiposContraPartido(
        partido,
        { local: cand.homeName, visita: cand.awayName },
        "coolbet",
      );
      if (ok) {
        if (match) {
          logger.warn(
            { partidoId: partido.id, source: "scrapers:coolbet:discovery" },
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
          source: "scrapers:coolbet:discovery",
        },
        "discovery sin match único — pendiente de vinculación manual",
      );
      return null;
    }
    return match.id;
  },

  async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
    if (!/^\d+$/.test(eventIdExterno)) {
      throw new Error(
        `Coolbet: eventId inválido "${eventIdExterno}" — se esperaba número entero`,
      );
    }

    const { payload, url } = await fetchOddsConRetry(eventIdExterno);

    if (!payload || typeof payload !== "object") {
      throw new Error(
        `Coolbet: respuesta vacía/malformada para ${eventIdExterno}`,
      );
    }

    const cuotas = mapearCuotasCoolbet(payload);
    if (Object.keys(cuotas).length === 0) {
      throw new Error(
        `Coolbet: el partido ${eventIdExterno} no expuso ningún mercado conocido (1X2/DobleOp/Totales 2.5/BTTS)`,
      );
    }

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
    };
  },
};

export default coolbetScraper;

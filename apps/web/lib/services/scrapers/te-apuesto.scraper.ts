// Scraper Te Apuesto (Intralot) — Lote V fase V.2.
//
// Casa más simple del scope: una sola request a `matches-of-the-day`
// devuelve TODOS los partidos del torneo con sus 4 mercados. POC del
// 03/05/2026 — sección 2.7 — confirma esta característica empíricamente.
//
// Endpoint clave:
//   GET https://api.teapuesto.pe/api/v4/nfs/matches-of-the-day
//
// Para Liga 1 Perú la URL del torneo (humana) es:
//   https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899
// donde el query `id=1,476,1899` codifica `sport,country,tournament`.
// Tournament ID Liga 1 Perú = 1899 (validado POC).
//
// El POC NO documentó el shape exacto del JSON de respuesta — sólo confirmó
// que un solo fetch trae los 4 mercados de los ~10 partidos de Liga 1 con
// la estructura de "grilla de 11 columnas" que se ve en la UI. Por eso el
// parser de abajo es DEFENSIVO: usa lookups por nombres de campo comunes y
// lanza Error con detalle si no encuentra lo esperado, para que el admin
// vea el mensaje en `cuotas_casa.errorMensaje` y se ajuste cuando V.5
// haga QA con respuestas reales.
//
// Discovery V.2: sólo Liga 1 Perú (tournament_id 1899 hardcoded). Otras
// ligas devuelven null y caen al fallback manual (Lote V.5). Cuando se
// agreguen Premier League / LaLiga / etc., extender `TOURNAMENT_ID_POR_LIGA`.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import {
  matchearEquiposContraPartido,
  fechasCercanas,
} from "./alias-equipo";
import type {
  CuotasCapturadas,
  ResultadoScraper,
  Scraper,
} from "./types";

// Mapeo Liga (canónico de Partido.liga) → tournament_id de Te Apuesto.
// Cuando Partido.liga llega como "Liga 1 Perú · Apertura" usamos
// `includes()` para que el sufijo de fase no rompa el match.
const TOURNAMENT_ID_POR_LIGA: Array<{ ligaIncludes: string; tournamentId: number }> = [
  { ligaIncludes: "Liga 1", tournamentId: 1899 },
];

const ENDPOINT_BASE = "https://api.teapuesto.pe/api/v4/nfs/matches-of-the-day";
const VENTANA_MATCH_MIN = 60;

interface PartidoSlim {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
}

/**
 * Match crudo extraído de la respuesta `matches-of-the-day`. Los campos
 * son nombres tentativos — el parser tolera varias convenciones.
 */
interface TeApuestoMatchCrudo {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date;
  cuotas: CuotasCapturadas;
}

function tournamentIdParaLiga(liga: string): number | null {
  for (const { ligaIncludes, tournamentId } of TOURNAMENT_ID_POR_LIGA) {
    if (liga.includes(ligaIncludes)) return tournamentId;
  }
  return null;
}

/**
 * Intenta extraer un valor numérico positivo de un objeto. Tolera string
 * con coma o punto decimal. Retorna undefined si no se puede convertir.
 */
function toCuota(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const norm = v.replace(",", ".").trim();
    const n = Number(norm);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Extrae cuotas de un nodo "match" de la respuesta. Hace lookup por nombres
 * comunes: la API de Intralot tiende a exponer mercados como objetos con
 * `code` o `name` (según versión). Si una key conocida no existe, intenta
 * variantes; si ninguna pega, ese mercado queda undefined.
 *
 * Esto es resiliente a versiones del API y permite que el scraper devuelva
 * cobertura parcial (mejor 3/4 mercados que 0).
 */
function parsearCuotas(node: Record<string, unknown>): CuotasCapturadas {
  const out: CuotasCapturadas = {};

  const markets = (node.markets ?? node.bets ?? node.mercados ?? node.outcomes) as
    | Record<string, unknown>
    | unknown[]
    | undefined;
  if (!markets) return out;

  // Helper: dado un valor que puede ser objeto (con .home/.draw/.away o
  // .odds) o array (con .code/.value), extrae los outcomes.
  function leerOutcomes(
    raw: unknown,
    keys: { home?: string[]; draw?: string[]; away?: string[]; over?: string[]; under?: string[]; yes?: string[]; no?: string[]; x1?: string[]; x12?: string[]; xx2?: string[] },
  ): Record<string, number | undefined> {
    if (!raw || typeof raw !== "object") return {};
    const result: Record<string, number | undefined> = {};

    if (Array.isArray(raw)) {
      for (const item of raw as Array<Record<string, unknown>>) {
        if (!item || typeof item !== "object") continue;
        const code = String(item.code ?? item.name ?? item.outcome ?? "").toLowerCase();
        const odd = toCuota(item.value ?? item.odd ?? item.price);
        if (!code || odd === undefined) continue;
        for (const [outName, codes] of Object.entries(keys)) {
          if (!codes) continue;
          if (codes.some((c) => code === c.toLowerCase() || code.endsWith(c.toLowerCase()))) {
            result[outName] = odd;
          }
        }
      }
      return result;
    }

    // Objeto: lookup por keys directas.
    const obj = raw as Record<string, unknown>;
    for (const [outName, codes] of Object.entries(keys)) {
      if (!codes) continue;
      for (const c of codes) {
        const v = toCuota(obj[c]);
        if (v !== undefined) {
          result[outName] = v;
          break;
        }
      }
    }
    return result;
  }

  // Resolver el contenedor "1x2": puede ser markets["1x2"] o
  // markets["matchResult"] o un item con name="1X2" en arrays.
  function getMercado(...names: string[]): unknown | undefined {
    if (Array.isArray(markets)) {
      for (const m of markets as Array<Record<string, unknown>>) {
        const n = String(m?.code ?? m?.name ?? m?.id ?? "").toLowerCase();
        if (names.some((target) => n === target.toLowerCase() || n.includes(target.toLowerCase()))) {
          return m.outcomes ?? m.values ?? m.selections ?? m;
        }
      }
      return undefined;
    }
    const obj = markets as Record<string, unknown>;
    for (const n of names) {
      if (n in obj) return obj[n];
    }
    return undefined;
  }

  // 1X2
  const m1x2 = getMercado("1x2", "matchResult", "match_result", "winner", "1X2");
  if (m1x2) {
    const o = leerOutcomes(m1x2, {
      home: ["home", "1", "local", "h"],
      draw: ["draw", "x", "empate", "d"],
      away: ["away", "2", "visita", "v", "a"],
    });
    if (o.home !== undefined && o.draw !== undefined && o.away !== undefined) {
      out["1x2"] = { local: o.home, empate: o.draw, visita: o.away };
    }
  }

  // Doble Op
  const mDob = getMercado(
    "doble_op",
    "doubleChance",
    "double_chance",
    "doble_oportunidad",
    "doble oportunidad",
    "DOBLE OP",
  );
  if (mDob) {
    const o = leerOutcomes(mDob, {
      x1: ["1x", "1X", "homeOrDraw"],
      x12: ["12", "homeOrAway", "noDraw"],
      xx2: ["x2", "X2", "drawOrAway"],
    });
    if (o.x1 !== undefined && o.x12 !== undefined && o.xx2 !== undefined) {
      out.doble_op = { x1: o.x1, x12: o.x12, xx2: o.xx2 };
    }
  }

  // Total ±2.5 — Te Apuesto expone la "S=2.5" line. Asumimos que el mercado
  // expuesto es el de 2.5 (POC confirma). Si el API empieza a servir
  // varias líneas, hay que filtrar por línea explícita acá.
  const mOu = getMercado(
    "mas_menos_25",
    "totalGoals25",
    "totalGoals",
    "total_goals",
    "totals",
    "ou_25",
    "over_under_2_5",
  );
  if (mOu) {
    const o = leerOutcomes(mOu, {
      over: ["over", "over_2_5", "more", "mas", "más", "+2.5"],
      under: ["under", "under_2_5", "less", "menos", "-2.5"],
    });
    if (o.over !== undefined && o.under !== undefined) {
      out.mas_menos_25 = { over: o.over, under: o.under };
    }
  }

  // BTTS
  const mBtts = getMercado(
    "btts",
    "bothTeamsToScore",
    "both_teams_to_score",
    "ambosEquipos",
    "ambos_equipos",
    "ambos equipos anotan",
  );
  if (mBtts) {
    const o = leerOutcomes(mBtts, {
      yes: ["yes", "si", "sí"],
      no: ["no"],
    });
    if (o.yes !== undefined && o.no !== undefined) {
      out.btts = { si: o.yes, no: o.no };
    }
  }

  return out;
}

/**
 * Recorre el payload entero buscando matches. Tolera respuestas con shape
 * `{matches: []}`, `{events: []}`, `{data: {matches: []}}`, etc.
 */
function extraerMatches(payload: unknown): TeApuestoMatchCrudo[] {
  function toDate(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "number") {
      // Heurística: timestamps en segundos vs ms (api-football usa segundos).
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

  function readNombre(team: unknown): string {
    if (typeof team === "string") return team;
    if (team && typeof team === "object") {
      const t = team as Record<string, unknown>;
      const n = t.name ?? t.shortName ?? t.code;
      if (typeof n === "string") return n;
    }
    return "";
  }

  function findMatchesArray(node: unknown, depth = 0): unknown[] {
    if (depth > 5 || !node || typeof node !== "object") return [];
    if (Array.isArray(node)) {
      // Lista de objetos con shape "matchish".
      const sample = node.find((it) => it && typeof it === "object");
      if (
        sample &&
        typeof sample === "object" &&
        ("home" in sample ||
          "homeTeam" in sample ||
          "teams" in sample ||
          "participants" in sample)
      ) {
        return node;
      }
      // Recorrer cada elemento.
      for (const item of node) {
        const found = findMatchesArray(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    const obj = node as Record<string, unknown>;
    for (const key of ["matches", "events", "data", "items", "results", "fixtures"]) {
      if (key in obj) {
        const found = findMatchesArray(obj[key], depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  const arr = findMatchesArray(payload);
  const out: TeApuestoMatchCrudo[] = [];
  for (const node of arr) {
    if (!node || typeof node !== "object") continue;
    const m = node as Record<string, unknown>;

    const id = String(m.id ?? m.eventId ?? m.matchId ?? "");
    if (!id) continue;

    // Equipos: probar los shapes más comunes.
    let homeName = readNombre(m.homeTeam ?? m.home);
    let awayName = readNombre(m.awayTeam ?? m.away);
    if ((!homeName || !awayName) && m.teams && typeof m.teams === "object") {
      const t = m.teams as Record<string, unknown>;
      if (!homeName) homeName = readNombre(t.home);
      if (!awayName) awayName = readNombre(t.away);
    }
    if (!homeName || !awayName) {
      // participants: [{ side: "home"|"away", name }]
      const participants = m.participants;
      if (Array.isArray(participants)) {
        for (const p of participants as Array<Record<string, unknown>>) {
          const side = String(p?.side ?? p?.role ?? "").toLowerCase();
          const name = readNombre(p);
          if (side === "home" && !homeName) homeName = name;
          if (side === "away" && !awayName) awayName = name;
        }
      }
    }
    if (!homeName || !awayName) continue;

    const kickoff = toDate(
      m.kickoff ?? m.kickoffTime ?? m.startTime ?? m.startsAt ?? m.date ?? m.timestamp,
    );
    if (!kickoff) continue;

    const cuotas = parsearCuotas(m);
    out.push({ id, homeName, awayName, kickoff, cuotas });
  }
  return out;
}

async function fetchMatchesDelTorneo(
  tournamentId: number,
): Promise<TeApuestoMatchCrudo[]> {
  // Te Apuesto acepta `tournament_id` como query param. La key precisa
  // varía según la versión del API; mandamos varias variantes para
  // maximizar el hit. Si la API ignora alguna, no rompe.
  const qs = new URLSearchParams({
    tournament_id: String(tournamentId),
    tournamentId: String(tournamentId),
    sport_id: "1", // fútbol
  });
  const url = `${ENDPOINT_BASE}?${qs.toString()}`;
  const payload = await httpFetchJson<unknown>(url, {
    source: "scrapers:te-apuesto",
    headers: {
      Origin: "https://www.teapuesto.pe",
      Referer: "https://www.teapuesto.pe/",
    },
  });
  return extraerMatches(payload);
}

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async buscarEventIdExterno(partido: PartidoSlim): Promise<string | null> {
    const torneoId = tournamentIdParaLiga(partido.liga);
    if (torneoId === null) {
      logger.debug(
        { partidoId: partido.id, liga: partido.liga, source: "scrapers:te-apuesto" },
        "discovery omitido — liga sin tournament_id mapeado",
      );
      return null;
    }

    let candidatos: TeApuestoMatchCrudo[];
    try {
      candidatos = await fetchMatchesDelTorneo(torneoId);
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, partidoId: partido.id, source: "scrapers:te-apuesto" },
        "discovery — fetch falló",
      );
      return null;
    }

    let match: TeApuestoMatchCrudo | null = null;
    for (const cand of candidatos) {
      if (!fechasCercanas(cand.kickoff, partido.fechaInicio, VENTANA_MATCH_MIN)) {
        continue;
      }
      const ok = await matchearEquiposContraPartido(
        partido,
        { local: cand.homeName, visita: cand.awayName },
        "te_apuesto",
      );
      if (ok) {
        if (match) {
          // Match ambiguo (>1 candidato) → no resolver, dejar al manual.
          logger.warn(
            { partidoId: partido.id, source: "scrapers:te-apuesto" },
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
          torneoId,
          source: "scrapers:te-apuesto",
        },
        "discovery sin match único — pendiente de vinculación manual",
      );
      return null;
    }
    return match.id;
  },

  async capturarCuotas(eventIdExterno: string): Promise<ResultadoScraper> {
    // Te Apuesto no expone endpoint por evento individual: hay que pedir
    // la grilla completa del torneo y filtrar. Para V.2 asumimos Liga 1
    // (única liga soportada). Cuando se extiendan ligas, persistir el
    // torneo en `EventIdExterno` (o derivarlo del partido en BD).
    const torneoId = TOURNAMENT_ID_POR_LIGA[0].tournamentId;
    const candidatos = await fetchMatchesDelTorneo(torneoId);
    const match = candidatos.find((c) => c.id === eventIdExterno);
    if (!match) {
      throw new Error(
        `Te Apuesto: eventId ${eventIdExterno} no aparece en matches-of-the-day del torneo ${torneoId}`,
      );
    }
    if (Object.keys(match.cuotas).length === 0) {
      throw new Error(
        `Te Apuesto: el partido ${eventIdExterno} no expuso ningún mercado conocido (1x2, doble_op, ±2.5, btts)`,
      );
    }
    return {
      cuotas: match.cuotas,
      fuente: { url: ENDPOINT_BASE, capturadoEn: new Date() },
    };
  },
};

export default teApuestoScraper;
